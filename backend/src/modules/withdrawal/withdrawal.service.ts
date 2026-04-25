import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  KycStatus,
  Prisma,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals.query.dto';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import { toDecimal } from '../../common/money/decimal.util';

const WD_PREFIX = 'WD';
const DUPLICATE_WINDOW_MS = 30_000;

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private newReference(): string {
    return `${WD_PREFIX}-${randomUUID()}`;
  }

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const normalizedIdempotencyKey = dto.idempotencyKey.trim();

    const existingByIdempotency = await this.prisma.withdrawal.findFirst({
      where: {
        userId,
        idempotencyKey: normalizedIdempotencyKey,
      },
    });
    if (existingByIdempotency) {
      return this.serializeWithdrawal(existingByIdempotency);
    }

    if (dto.currency !== 'NGN') {
      throw new BadRequestException('Only NGN withdrawals are supported');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isFrozen: true, kycStatus: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.isFrozen) throw new ForbiddenException('Account is disabled');
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException({
        code: 'KYC_REQUIRED',
        message: 'Verified KYC is required to withdraw',
      });
    }

    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const linkedBank = await this.prisma.linkedBankAccount.findFirst({
      where: { id: dto.linkedBankAccountId, userId, currency: Currency.NGN },
    });
    if (!linkedBank) {
      throw new BadRequestException('Linked bank not found or does not belong to you');
    }

    const duplicateCutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const existingDuplicate = await this.prisma.withdrawal.findFirst({
      where: {
        userId,
        amount: moneyStr(amount),
        linkedBankAccountId: linkedBank.id,
        status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
        createdAt: { gte: duplicateCutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDuplicate) {
      return this.serializeWithdrawal(existingDuplicate);
    }

    await this.authService.verifyTransactionOtpForUser(userId, dto.otp);

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency: Currency.NGN } },
    });
    if (!wallet) throw new BadRequestException('NGN wallet not found');

    const fee = fixMoney(new Decimal(0));
    const netAmount = fixMoney(amount);

    const reference = this.newReference();

    const bankSnapshot = {
      linkedBankAccountId: linkedBank.id,
      accountNumber: linkedBank.accountNumber,
      bankName: linkedBank.bankName,
      accountName: linkedBank.accountName,
      bankCode: linkedBank.bankCode ?? null,
    };

    const metadata: Prisma.InputJsonValue = {
      bankSnapshot,
      payoutProvider: 'manual_pending',
      note: 'Funds held pending payout; provider integration not live',
    };

    try {
      const withdrawal = await this.prisma.$transaction(async (tx) => {
        const inTxExistingByIdempotency = await tx.withdrawal.findFirst({
          where: { userId, idempotencyKey: normalizedIdempotencyKey },
        });
        if (inTxExistingByIdempotency) {
          return inTxExistingByIdempotency;
        }

        const inTxExistingDuplicate = await tx.withdrawal.findFirst({
          where: {
            userId,
            amount: moneyStr(amount),
            linkedBankAccountId: linkedBank.id,
            status: { in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
            createdAt: { gte: duplicateCutoff },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (inTxExistingDuplicate) {
          return inTxExistingDuplicate;
        }

        await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, wallet.id);

        const locked = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        const bal = toDecimal(locked.balance.toString());
        if (bal.lt(amount)) {
          throw new BadRequestException('Insufficient balance');
        }

        const newBal = fixMoney(bal.minus(amount));
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: moneyStr(newBal) },
        });

        const wd = await tx.withdrawal.create({
          data: {
            userId,
            idempotencyKey: normalizedIdempotencyKey,
            walletId: wallet.id,
            linkedBankAccountId: linkedBank.id,
            reference,
            amount: moneyStr(amount),
            fee: moneyStr(fee),
            netAmount: moneyStr(netAmount),
            currency: Currency.NGN,
            status: WithdrawalStatus.PENDING,
            initiatedAt: new Date(),
            metadata,
          },
        });

        const ledgerMeta: Prisma.InputJsonValue = {
          withdrawalId: wd.id,
          reference: wd.reference,
          bankSnapshot,
          ledgerRole: 'WITHDRAWAL_DEBIT',
        };

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId,
            reference: `${wd.reference}-DEBIT`,
            groupId: wd.reference,
            externalReference: null,
            type: TransactionType.WALLET_WITHDRAWAL,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(amount),
            fee: moneyStr(fee),
            netAmount: moneyStr(netAmount),
            currency: Currency.NGN,
            direction: TransactionDirection.DEBIT,
            metadata: ledgerMeta,
          },
        });

        return wd;
      });

      if (withdrawal.reference === reference) {
        try {
          await this.notificationsService.notifyWithdrawalInitiated(
            userId,
            moneyStr(amount),
            dto.currency,
            withdrawal.id,
          );
        } catch (e) {
          this.logger.warn(`withdrawal notify initiated failed: ${e}`);
        }
      }

      return this.serializeWithdrawal(withdrawal, bankSnapshot);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await this.prisma.withdrawal.findFirst({
          where: { userId, idempotencyKey: normalizedIdempotencyKey },
        });
        if (raced) return this.serializeWithdrawal(raced);
      }
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`createWithdrawal failed userId=${userId}`, e instanceof Error ? e.stack : e);
      throw e;
    }
  }

  async listWithdrawals(userId: string, query: ListWithdrawalsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({ where: { userId } }),
    ]);

    return {
      items: items.map((w) => this.serializeWithdrawal(w)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getWithdrawalById(userId: string, id: string) {
    const w = await this.prisma.withdrawal.findFirst({
      where: { id, userId },
    });
    if (!w) throw new NotFoundException('Withdrawal not found');
    return this.serializeWithdrawal(w);
  }

  /** Move to processing (e.g. payout job picked up). */
  async markProcessing(id: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Cannot mark processing from status ${w.status}`);
    }
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PROCESSING,
        processedAt: new Date(),
      },
    });
  }

  async markCompleted(id: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(`Cannot complete from status ${w.status}`);
    }
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    try {
      await this.notificationsService.notifyWithdrawalCompleted(
        w.userId,
        w.amount.toString(),
        w.currency,
        w.id,
      );
    } catch (e) {
      this.logger.warn(`withdrawal notify completed failed: ${e}`);
    }
    return updated;
  }

  /**
   * Reverse wallet debit and mark withdrawal failed (payout could not be completed).
   */
  async markFailed(id: string, reason: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status === WithdrawalStatus.COMPLETED) {
      throw new BadRequestException('Cannot fail a completed withdrawal');
    }
    if (w.status === WithdrawalStatus.FAILED) {
      return w;
    }
    if (w.status === WithdrawalStatus.CANCELLED) {
      throw new BadRequestException('Withdrawal was cancelled');
    }

    const amount = fixMoney(toDecimal(w.amount.toString()));

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Withdrawal not found');
      if (current.status === WithdrawalStatus.FAILED) return;

      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, w.walletId);
      const locked = await tx.wallet.findUniqueOrThrow({ where: { id: w.walletId } });
      const bal = toDecimal(locked.balance.toString());
      const newBal = fixMoney(bal.plus(amount));
      await tx.wallet.update({
        where: { id: w.walletId },
        data: { balance: moneyStr(newBal) },
      });

      const reversalRef = `${w.reference}-REV-${randomUUID().slice(0, 8)}`;
      const revMeta: Prisma.InputJsonValue = {
        withdrawalId: w.id,
        reference: w.reference,
        reversal: true,
        reason,
        ledgerRole: 'WITHDRAWAL_REVERSAL_CREDIT',
      };

      await tx.transaction.create({
        data: {
          walletId: w.walletId,
          userId: w.userId,
          reference: reversalRef,
          groupId: w.reference,
          externalReference: null,
          type: TransactionType.WALLET_WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(amount),
          fee: null,
          netAmount: moneyStr(amount),
          currency: w.currency,
          direction: TransactionDirection.CREDIT,
          metadata: revMeta,
        },
      });

      await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: reason.slice(0, 2000),
        },
      });
    });

    const updated = await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    try {
      await this.notificationsService.notifyWithdrawalFailed(
        w.userId,
        w.amount.toString(),
        w.currency,
        reason,
        w.id,
      );
    } catch (e) {
      this.logger.warn(`withdrawal notify failed: ${e}`);
    }
    return updated;
  }

  private serializeWithdrawal(
    w: {
      id: string;
      reference: string;
      amount: Prisma.Decimal;
      fee: Prisma.Decimal;
      netAmount: Prisma.Decimal;
      currency: Currency;
      status: WithdrawalStatus;
      failureReason: string | null;
      initiatedAt: Date;
      processedAt: Date | null;
      completedAt: Date | null;
      metadata: Prisma.JsonValue | null;
      linkedBankAccountId: string;
      createdAt: Date;
      updatedAt: Date;
    },
    snapshot?: {
      linkedBankAccountId: string;
      accountNumber: string;
      bankName: string;
      accountName: string;
      bankCode: string | null;
    },
  ) {
    const meta = (w.metadata ?? null) as Record<string, unknown> | null;
    type Snap = {
      linkedBankAccountId?: string;
      accountNumber?: string;
      bankName?: string;
      accountName?: string;
      bankCode?: string | null;
    };
    const bank: Snap | undefined =
      snapshot ?? (meta?.bankSnapshot as Snap | undefined);

    return {
      id: w.id,
      reference: w.reference,
      amount: w.amount.toString(),
      fee: w.fee.toString(),
      netAmount: w.netAmount.toString(),
      currency: w.currency,
      status: w.status,
      failureReason: w.failureReason,
      initiatedAt: w.initiatedAt,
      processedAt: w.processedAt,
      completedAt: w.completedAt,
      linkedBankAccountId: w.linkedBankAccountId,
      recipientBank: bank
        ? {
            id: bank.linkedBankAccountId ?? w.linkedBankAccountId,
            accountNumber: bank.accountNumber,
            bankName: bank.bankName,
            accountName: bank.accountName,
            bankCode: bank.bankCode ?? null,
            currency: w.currency,
          }
        : { id: w.linkedBankAccountId, currency: w.currency },
      metadata: w.metadata,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }
}
