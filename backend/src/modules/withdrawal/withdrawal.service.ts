import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  KycStatus,
  Prisma,
  TransactionDirection,
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
import { WalletService } from '../wallet/wallet.service';
import {
  PAYOUT_PROVIDER,
  PayoutProvider,
  ParsedTransferWebhook,
} from '../payout/payout-provider.interface';

const WD_PREFIX = 'WD';
const DUPLICATE_WINDOW_MS = 30_000;
const REVERSAL_SUFFIX = '-REVERSAL';

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    private readonly walletService: WalletService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
  ) {}

  private newReference(): string {
    return `${WD_PREFIX}-${randomUUID()}`;
  }

  private assertTransition(from: WithdrawalStatus, to: WithdrawalStatus) {
    const allowed: Record<WithdrawalStatus, WithdrawalStatus[]> = {
      PENDING: [WithdrawalStatus.PROCESSING, WithdrawalStatus.FAILED, WithdrawalStatus.CANCELLED],
      PROCESSING: [WithdrawalStatus.COMPLETED, WithdrawalStatus.FAILED],
      COMPLETED: [],
      FAILED: [],
      CANCELLED: [],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot transition withdrawal from ${from} to ${to}`);
    }
  }

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const normalizedIdempotencyKey = dto.idempotencyKey.trim();

    const existingByIdempotency = await this.prisma.withdrawal.findFirst({
      where: { userId, idempotencyKey: normalizedIdempotencyKey },
    });
    if (existingByIdempotency) return this.serializeWithdrawal(existingByIdempotency);

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
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    const linkedBank = await this.prisma.linkedBankAccount.findFirst({
      where: { id: dto.linkedBankAccountId, userId, currency: Currency.NGN },
    });
    if (!linkedBank) {
      throw new BadRequestException('Linked bank not found or does not belong to you');
    }
    if (!linkedBank.isVerified || !linkedBank.bankCode) {
      throw new BadRequestException('Linked bank must be provider-verified before withdrawal');
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
    if (existingDuplicate) return this.serializeWithdrawal(existingDuplicate);

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
      payoutProvider: 'flutterwave',
    };

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const inTxExistingByIdempotency = await tx.withdrawal.findFirst({
        where: { userId, idempotencyKey: normalizedIdempotencyKey },
      });
      if (inTxExistingByIdempotency) return inTxExistingByIdempotency;

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
      if (inTxExistingDuplicate) return inTxExistingDuplicate;

      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, wallet.id);
      const locked = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const bal = toDecimal(locked.balance.toString());
      if (bal.lt(amount)) throw new BadRequestException('Insufficient balance');

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

      const payoutWallet = await this.walletService.getPayoutWallet(tx, Currency.NGN);
      await this.walletService.postDoubleEntry(tx, wd.reference, [
        {
          walletId: wallet.id,
          userId,
          type: TransactionType.WALLET_WITHDRAWAL,
          direction: TransactionDirection.DEBIT,
          amount,
          currency: Currency.NGN,
          fee,
          netAmount,
          metadata: {
            withdrawalId: wd.id,
            reference: wd.reference,
            bankSnapshot,
            ledgerRole: 'WITHDRAWAL_USER_DEBIT',
          } as Prisma.InputJsonValue,
        },
        {
          walletId: payoutWallet.id,
          userId: null,
          type: TransactionType.WALLET_WITHDRAWAL,
          direction: TransactionDirection.CREDIT,
          amount,
          currency: Currency.NGN,
          fee,
          netAmount,
          metadata: {
            withdrawalId: wd.id,
            reference: wd.reference,
            bankSnapshot,
            ledgerRole: 'WITHDRAWAL_PAYOUT_CREDIT',
          } as Prisma.InputJsonValue,
        },
      ]);

      return wd;
    });

    if (withdrawal.reference === reference) {
      await this.safeNotifyInitiated(userId, moneyStr(amount), dto.currency, withdrawal.id);
      await this.initiatePayoutForWithdrawal(withdrawal.id);
      const refreshed = await this.prisma.withdrawal.findUnique({ where: { id: withdrawal.id } });
      if (refreshed) return this.serializeWithdrawal(refreshed, bankSnapshot);
    }
    return this.serializeWithdrawal(withdrawal, bankSnapshot);
  }

  private async safeNotifyInitiated(
    userId: string,
    amount: string,
    currency: 'NGN',
    withdrawalId: string,
  ) {
    try {
      await this.notificationsService.notifyWithdrawalInitiated(userId, amount, currency, withdrawalId);
    } catch (error) {
      this.logger.warn(`withdrawal notify initiated failed: ${error}`);
    }
  }

  async initiatePayoutForWithdrawal(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { linkedBankAccount: true },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) return withdrawal;
    if (!withdrawal.linkedBankAccount?.bankCode || !withdrawal.linkedBankAccount.isVerified) {
      return this.markFailed(withdrawalId, 'Linked bank is not verified for payout');
    }

    const transfer = await this.payoutProvider.initiateTransfer({
      amount: withdrawal.netAmount.toString(),
      currency: 'NGN',
      reference: withdrawal.reference,
      narration: `Cohold withdrawal ${withdrawal.reference}`,
      accountNumber: withdrawal.linkedBankAccount.accountNumber,
      bankCode: withdrawal.linkedBankAccount.bankCode,
      accountName: withdrawal.linkedBankAccount.accountName,
    });

    if (!transfer.accepted || transfer.status === 'FAILED') {
      return this.markFailed(
        withdrawalId,
        transfer.failureReason ?? 'Provider rejected transfer',
        transfer.providerReference,
        transfer.transferCode,
      );
    }

    const current = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!current) throw new NotFoundException('Withdrawal not found');
    if (current.status !== WithdrawalStatus.PENDING) return current;
    this.assertTransition(current.status, WithdrawalStatus.PROCESSING);

    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.PROCESSING,
        processedAt: new Date(),
        providerReference: transfer.providerReference ?? current.providerReference,
        providerTransferCode: transfer.transferCode ?? current.providerTransferCode,
        metadata: {
          ...(current.metadata as Record<string, unknown> | null),
          payoutInitiation: {
            accepted: transfer.accepted,
            rawStatus: transfer.rawStatus ?? null,
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  async handlePayoutWebhook(payload: Record<string, unknown>) {
    const parsed = this.payoutProvider.parseTransferWebhook(payload);
    if (!parsed) return { received: true };

    const withdrawal = await this.findByProviderWebhook(parsed);
    if (!withdrawal) return { received: true };

    if (parsed.status === 'SUCCESS') {
      if (withdrawal.status === WithdrawalStatus.COMPLETED) return { received: true };
      if (withdrawal.status === WithdrawalStatus.FAILED) return { received: true };
      await this.markCompleted(withdrawal.id, parsed.providerReference, parsed.transferCode);
      return { received: true };
    }

    if (parsed.status === 'FAILED') {
      await this.markFailed(
        withdrawal.id,
        parsed.failureReason ?? 'Provider reported payout failure',
        parsed.providerReference,
        parsed.transferCode,
      );
      return { received: true };
    }

    if (parsed.status === 'PROCESSING' && withdrawal.status === WithdrawalStatus.PENDING) {
      await this.markProcessing(withdrawal.id, parsed.providerReference, parsed.transferCode);
    }
    return { received: true };
  }

  private async findByProviderWebhook(parsed: ParsedTransferWebhook) {
    if (parsed.providerReference) {
      const byReference = await this.prisma.withdrawal.findFirst({
        where: {
          OR: [{ providerReference: parsed.providerReference }, { reference: parsed.providerReference }],
        },
      });
      if (byReference) return byReference;
    }
    if (parsed.transferCode) {
      return this.prisma.withdrawal.findFirst({
        where: { providerTransferCode: parsed.transferCode },
      });
    }
    return null;
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
    const w = await this.prisma.withdrawal.findFirst({ where: { id, userId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    return this.serializeWithdrawal(w);
  }

  async markProcessing(id: string, providerReference?: string | null, providerTransferCode?: string | null) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    this.assertTransition(w.status, WithdrawalStatus.PROCESSING);
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PROCESSING,
        processedAt: w.processedAt ?? new Date(),
        providerReference: providerReference ?? w.providerReference,
        providerTransferCode: providerTransferCode ?? w.providerTransferCode,
      },
    });
  }

  async markCompleted(id: string, providerReference?: string | null, providerTransferCode?: string | null) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status === WithdrawalStatus.COMPLETED) return w;
    this.assertTransition(w.status, WithdrawalStatus.COMPLETED);
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.COMPLETED,
        completedAt: new Date(),
        processedAt: w.processedAt ?? new Date(),
        providerReference: providerReference ?? w.providerReference,
        providerTransferCode: providerTransferCode ?? w.providerTransferCode,
      },
    });
    try {
      await this.notificationsService.notifyWithdrawalCompleted(
        updated.userId,
        updated.amount.toString(),
        updated.currency,
        updated.id,
      );
    } catch (error) {
      this.logger.warn(`withdrawal notify completed failed: ${error}`);
    }
    return updated;
  }

  async markFailed(
    id: string,
    reason: string,
    providerReference?: string | null,
    providerTransferCode?: string | null,
  ) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status === WithdrawalStatus.FAILED) return w;
    if (w.status === WithdrawalStatus.COMPLETED) {
      throw new BadRequestException('Cannot fail a completed withdrawal');
    }
    if (w.status === WithdrawalStatus.CANCELLED) {
      throw new BadRequestException('Withdrawal was cancelled');
    }
    this.assertTransition(w.status, WithdrawalStatus.FAILED);

    const amount = fixMoney(toDecimal(w.amount.toString()));
    const reversalReference = `${w.reference}${REVERSAL_SUFFIX}`;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Withdrawal not found');
      if (current.status === WithdrawalStatus.FAILED) return;
      if (current.status === WithdrawalStatus.COMPLETED) {
        throw new BadRequestException('Cannot fail a completed withdrawal');
      }

      const reversalLegs = await tx.transaction.findMany({ where: { reference: reversalReference } });
      if (reversalLegs.length === 0) {
        const payoutWallet = await this.walletService.getPayoutWallet(tx, current.currency);
        await this.walletService.postDoubleEntry(tx, reversalReference, [
          {
            walletId: payoutWallet.id,
            userId: null,
            type: TransactionType.WALLET_WITHDRAWAL,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: current.currency,
            externalReference: providerTransferCode ?? current.providerTransferCode ?? null,
            netAmount: amount,
            metadata: {
              withdrawalId: current.id,
              providerReference: providerReference ?? current.providerReference ?? null,
              providerTransferCode: providerTransferCode ?? current.providerTransferCode ?? null,
              reversal: true,
              failureReason: reason,
              ledgerRole: 'WITHDRAWAL_REVERSAL_PAYOUT_DEBIT',
            } as Prisma.InputJsonValue,
          },
          {
            walletId: current.walletId,
            userId: current.userId,
            type: TransactionType.WALLET_WITHDRAWAL,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: current.currency,
            externalReference: providerTransferCode ?? current.providerTransferCode ?? null,
            netAmount: amount,
            metadata: {
              withdrawalId: current.id,
              providerReference: providerReference ?? current.providerReference ?? null,
              providerTransferCode: providerTransferCode ?? current.providerTransferCode ?? null,
              reversal: true,
              failureReason: reason,
              ledgerRole: 'WITHDRAWAL_REVERSAL_USER_CREDIT',
            } as Prisma.InputJsonValue,
          },
        ]);
      } else if (reversalLegs.length === 1) {
        throw new BadRequestException(
          `Corrupt withdrawal reversal reference ${reversalReference}: single-leg entry detected`,
        );
      }

      await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: reason.slice(0, 2000),
          providerReference: providerReference ?? current.providerReference,
          providerTransferCode: providerTransferCode ?? current.providerTransferCode,
          processedAt: current.processedAt ?? new Date(),
          metadata: {
            ...(current.metadata as Record<string, unknown> | null),
            reversalApplied: true,
            reversalReference: reversalReference,
          } as Prisma.InputJsonValue,
        },
      });
    });

    const updated = await this.prisma.withdrawal.findUniqueOrThrow({ where: { id } });
    try {
      await this.notificationsService.notifyWithdrawalFailed(
        updated.userId,
        updated.amount.toString(),
        updated.currency,
        reason,
        updated.id,
      );
    } catch (error) {
      this.logger.warn(`withdrawal notify failed: ${error}`);
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
      providerReference?: string | null;
      providerTransferCode?: string | null;
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
    const bank: Snap | undefined = snapshot ?? (meta?.bankSnapshot as Snap | undefined);

    return {
      id: w.id,
      reference: w.reference,
      amount: w.amount.toString(),
      fee: w.fee.toString(),
      netAmount: w.netAmount.toString(),
      currency: w.currency,
      status: w.status,
      failureReason: w.failureReason,
      providerReference: w.providerReference ?? null,
      providerTransferCode: w.providerTransferCode ?? null,
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
