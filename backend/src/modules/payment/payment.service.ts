import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency, TransactionDirection, TransactionStatus, TransactionType } from '@prisma/client';
import { toDecimal } from '../../common/money/decimal.util';
import Decimal from 'decimal.js';
import { FlutterwaveService } from './flutterwave.service';
import { WalletService, PLATFORM_USER_ID } from '../wallet/wallet.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly walletService: WalletService,
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
    const init = await this.flutterwaveService.initializePayment({
      amount: amount.toNumber(),
      email: data.email ?? user.email,
      userId: data.userId,
      reference,
    });

    return {
      checkoutUrl: init.checkoutUrl,
      reference,
    };
  }

  async verifyWalletFunding(userId: string, reference: string) {
    const verified = await this.flutterwaveService.verifyPayment(reference);
    const expectedAmount = toDecimal(verified.amount.toString());

    const tx = await this.prisma.$transaction((trx) =>
      this.processWalletFunding(trx, {
        userId,
        amount: expectedAmount,
        reference,
        providerTransactionId: verified.txId,
      }),
    );
    return {
      id: tx[0]?.id,
      reference,
      status: TransactionStatus.COMPLETED,
      amount: expectedAmount.toString(),
      createdAt: tx[0]?.createdAt,
      updatedAt: tx[tx.length - 1]?.updatedAt,
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
    const existing = await tx.transaction.findMany({
      where: { reference: data.reference, type: TransactionType.WALLET_TOP_UP },
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length >= 2) {
      return existing;
    }

    let userWallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: data.userId, currency: Currency.NGN } },
      select: { id: true },
    });
    if (!userWallet) {
      await tx.wallet.create({
        data: {
          userId: data.userId,
          currency: Currency.NGN,
          balance: '0',
        },
      });
      userWallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: data.userId, currency: Currency.NGN } },
        select: { id: true },
      });
    }
    if (!userWallet) {
      throw new NotFoundException('Wallet not found');
    }
    const platformWallet = await this.walletService.getPlatformWallet(tx as Prisma.TransactionClient, Currency.NGN);
    return this.walletService.postDoubleEntry(tx as Prisma.TransactionClient, data.reference, [
      {
        walletId: platformWallet.id,
        userId: PLATFORM_USER_ID,
        type: TransactionType.WALLET_TOP_UP,
        direction: TransactionDirection.DEBIT,
        amount: data.amount,
        currency: Currency.NGN,
        externalReference: data.providerTransactionId ?? null,
        netAmount: data.amount,
        metadata: {
          provider: 'flutterwave',
          providerTransactionId: data.providerTransactionId ?? null,
          reason: 'flutterwave_wallet_funding',
        } as Prisma.InputJsonValue,
      },
      {
        walletId: userWallet.id,
        userId: data.userId,
        type: TransactionType.WALLET_TOP_UP,
        direction: TransactionDirection.CREDIT,
        amount: data.amount,
        currency: Currency.NGN,
        externalReference: data.providerTransactionId ?? null,
        netAmount: data.amount,
        metadata: {
          provider: 'flutterwave',
          providerTransactionId: data.providerTransactionId ?? null,
          reason: 'flutterwave_wallet_funding',
        } as Prisma.InputJsonValue,
      },
    ]);
  }

  async handleFlutterwaveWebhook(payload: Record<string, unknown>) {
    const eventData = (payload?.data as Record<string, unknown>) ?? {};
    const reference = eventData?.tx_ref as string | undefined;
    if (!reference) {
      return { received: true };
    }

    const pending = await this.prisma.transaction.findFirst({ where: { reference } });
    const metaUserId = ((eventData?.meta as Record<string, unknown> | undefined)?.userId as string | undefined) ?? null;
    const effectiveUserId = pending?.userId ?? metaUserId;
    if (!effectiveUserId) {
      this.logger.warn(`flutterwave webhook ignored: unknown reference=${reference}`);
      return { received: true };
    }

    const verified = await this.flutterwaveService.verifyPayment(reference);
    const expectedAmount = toDecimal(verified.amount.toString());

    await this.prisma.$transaction((trx) =>
      this.processWalletFunding(trx, {
        userId: effectiveUserId,
        amount: expectedAmount,
        reference,
        providerTransactionId: verified.txId,
      }),
    );
    return { received: true };
  }
}
