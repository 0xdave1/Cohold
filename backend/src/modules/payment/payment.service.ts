import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency, TransactionDirection, TransactionStatus, TransactionType } from '@prisma/client';
import { toDecimal } from '../../common/money/decimal.util';
import Decimal from 'decimal.js';
import { FlutterwaveService } from './flutterwave.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwaveService: FlutterwaveService,
  ) {}

  async initializeFlutterwavePayment(data: { amount: number; userId: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const amount = toDecimal(data.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const reference = `flw_wallet_${randomUUID()}`;
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId: data.userId, currency: Currency.NGN },
      select: { id: true },
    });

    await this.prisma.transaction.create({
      data: {
        walletId: wallet?.id ?? null,
        userId: data.userId,
        reference,
        groupId: reference,
        externalReference: null,
        type: TransactionType.WALLET_TOP_UP,
        status: TransactionStatus.PENDING,
        amount: amount.toFixed(4),
        currency: Currency.NGN,
        direction: TransactionDirection.CREDIT,
        metadata: { provider: 'flutterwave', stage: 'initialized' },
      },
    });

    const init = await this.flutterwaveService.initializePayment({
      amount: amount.toNumber(),
      email: data.email ?? user.email,
      reference,
    });

    return {
      checkoutUrl: init.checkoutUrl,
      reference,
    };
  }

  async verifyWalletFunding(userId: string, reference: string) {
    const pending = await this.prisma.transaction.findFirst({
      where: {
        userId,
        reference,
        type: TransactionType.WALLET_TOP_UP,
      },
    });
    if (!pending) {
      throw new NotFoundException('Funding transaction not found');
    }

    const verified = await this.flutterwaveService.verifyPayment(reference);
    const expectedAmount = toDecimal(pending.amount.toString());
    if (!expectedAmount.eq(toDecimal(verified.amount.toString()))) {
      throw new BadRequestException('Verified amount mismatch');
    }

    const tx = await this.prisma.$transaction((trx) =>
      this.processWalletFunding(trx, {
        userId,
        amount: expectedAmount,
        reference,
        providerTransactionId: verified.txId,
      }),
    );
    return {
      id: tx.id,
      reference: tx.reference,
      status: tx.status,
      amount: tx.amount.toString(),
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  async processWalletFunding(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      amount: Decimal;
      reference: string;
      providerTransactionId?: string | null;
    },
  ) {
    const existing = await tx.transaction.findUnique({ where: { reference: data.reference } });
    if (existing && existing.status === TransactionStatus.COMPLETED) {
      return existing;
    }

    let lockedWallet = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>(
      Prisma.sql`SELECT "id", "balance" FROM "Wallet" WHERE "userId" = ${data.userId} AND "currency" = ${Currency.NGN} FOR UPDATE`,
    );
    if (!lockedWallet.length) {
      await tx.wallet.create({
        data: {
          userId: data.userId,
          currency: Currency.NGN,
          balance: '0',
        },
      });
      lockedWallet = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>(
        Prisma.sql`SELECT "id", "balance" FROM "Wallet" WHERE "userId" = ${data.userId} AND "currency" = ${Currency.NGN} FOR UPDATE`,
      );
    }
    if (!lockedWallet.length) {
      throw new NotFoundException('Wallet not found');
    }

    const wallet = lockedWallet[0];
    const nextBalance = toDecimal(wallet.balance.toString()).plus(data.amount).toFixed(4);
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: nextBalance },
    });

    if (existing) {
      return tx.transaction.update({
        where: { id: existing.id },
        data: {
          walletId: wallet.id,
          status: TransactionStatus.COMPLETED,
          amount: data.amount.toFixed(4),
          metadata: {
            ...(existing.metadata as Record<string, unknown> | null),
            provider: 'flutterwave',
            providerTransactionId: data.providerTransactionId ?? null,
            stage: 'completed',
          } as Prisma.InputJsonValue,
        },
      });
    }

    return tx.transaction.create({
      data: {
        walletId: wallet.id,
        userId: data.userId,
        reference: data.reference,
        groupId: data.reference,
        externalReference: data.providerTransactionId ?? null,
        type: TransactionType.WALLET_TOP_UP,
        status: TransactionStatus.COMPLETED,
        amount: data.amount.toFixed(4),
        currency: Currency.NGN,
        direction: TransactionDirection.CREDIT,
        metadata: {
          provider: 'flutterwave',
          providerTransactionId: data.providerTransactionId ?? null,
          reason: 'flutterwave_wallet_funding',
        },
      },
    });
  }

  async handleFlutterwaveWebhook(payload: Record<string, unknown>) {
    const eventData = (payload?.data as Record<string, unknown>) ?? {};
    const reference = eventData?.tx_ref as string | undefined;
    if (!reference) {
      return { received: true };
    }

    const pending = await this.prisma.transaction.findUnique({ where: { reference } });
    if (!pending?.userId) {
      this.logger.warn(`flutterwave webhook ignored: unknown reference=${reference}`);
      return { received: true };
    }

    const verified = await this.flutterwaveService.verifyPayment(reference);
    const expectedAmount = toDecimal(pending.amount.toString());
    if (!expectedAmount.eq(toDecimal(verified.amount.toString()))) {
      throw new BadRequestException('Verified amount mismatch');
    }

    await this.prisma.$transaction((trx) =>
      this.processWalletFunding(trx, {
        userId: pending.userId as string,
        amount: expectedAmount,
        reference,
        providerTransactionId: verified.txId,
      }),
    );
    return { received: true };
  }
}
