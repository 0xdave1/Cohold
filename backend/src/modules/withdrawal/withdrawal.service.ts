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
  LedgerOperationType,
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
  InitiateTransferResult,
  PAYOUT_PROVIDER,
  PayoutProvider,
  ParsedTransferWebhook,
  TransferPollResult,
} from '../payout/payout-provider.interface';

const WD_PREFIX = 'WD';
const DUPLICATE_WINDOW_MS = 30_000;
const REVERSAL_SUFFIX = '-REVERSAL';
/** Idempotent reversal ledger grouping key (preferred over legacy `${reference}-REVERSAL`). */
const reversalReferenceFor = (withdrawalId: string) => `WITHDRAWAL_REVERSAL:${withdrawalId}`;

const LATE_SUCCESS_REVERSAL_CONFLICT_REASON =
  'Provider confirmed SUCCESS after local failure/reversal. Possible bank-paid + wallet-refunded conflict.';

const ACTIVE_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.INITIATING,
  WithdrawalStatus.PROCESSING,
  WithdrawalStatus.RECONCILIATION_REQUIRED,
];

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
      PENDING: [
        WithdrawalStatus.INITIATING,
        WithdrawalStatus.PROCESSING,
        WithdrawalStatus.FAILED,
        WithdrawalStatus.CANCELLED,
        WithdrawalStatus.RECONCILIATION_REQUIRED,
        WithdrawalStatus.COMPLETED,
      ],
      INITIATING: [
        WithdrawalStatus.PROCESSING,
        WithdrawalStatus.FAILED,
        WithdrawalStatus.RECONCILIATION_REQUIRED,
        WithdrawalStatus.COMPLETED,
      ],
      PROCESSING: [
        WithdrawalStatus.COMPLETED,
        WithdrawalStatus.FAILED,
        WithdrawalStatus.RECONCILIATION_REQUIRED,
      ],
      RECONCILIATION_REQUIRED: [
        WithdrawalStatus.PROCESSING,
        WithdrawalStatus.COMPLETED,
        WithdrawalStatus.FAILED,
      ],
      COMPLETED: [],
      FAILED: [WithdrawalStatus.COMPLETED, WithdrawalStatus.RECONCILIATION_REQUIRED],
      CANCELLED: [],
    };
    if (!allowed[from]?.includes(to)) {
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
        status: { in: ACTIVE_WITHDRAWAL_STATUSES },
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
          status: { in: ACTIVE_WITHDRAWAL_STATUSES },
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
      ], {
        operationType: LedgerOperationType.WITHDRAWAL_DEBIT,
        sourceModule: 'withdrawal.createWithdrawal',
        sourceId: wd.id,
      });

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

    if (
      withdrawal.status === WithdrawalStatus.COMPLETED ||
      withdrawal.status === WithdrawalStatus.CANCELLED ||
      withdrawal.status === WithdrawalStatus.FAILED
    ) {
      return withdrawal;
    }
    if (
      withdrawal.status === WithdrawalStatus.PROCESSING ||
      withdrawal.status === WithdrawalStatus.RECONCILIATION_REQUIRED
    ) {
      return withdrawal;
    }

    if (withdrawal.status === WithdrawalStatus.INITIATING) {
      return this.resumeInitiatingWithdrawal(withdrawal);
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return withdrawal;
    }

    if (!withdrawal.linkedBankAccount?.bankCode || !withdrawal.linkedBankAccount.isVerified) {
      return this.markFailed(withdrawalId, 'Linked bank is not verified for payout', null, null, {
        authoritative: true,
      });
    }

    const claimed = await this.prisma.withdrawal.updateMany({
      where: { id: withdrawalId, status: WithdrawalStatus.PENDING },
      data: { status: WithdrawalStatus.INITIATING, processedAt: new Date() },
    });
    if (claimed.count === 0) {
      return this.prisma.withdrawal.findUniqueOrThrow({
        where: { id: withdrawalId },
        include: { linkedBankAccount: true },
      });
    }

    const locked = await this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawalId },
      include: { linkedBankAccount: true },
    });

    const bank = locked.linkedBankAccount!;
    const bankCode = bank.bankCode;
    if (!bankCode) {
      return this.markFailed(withdrawalId, 'Linked bank is not verified for payout', null, null, {
        authoritative: true,
      });
    }
    const transfer = await this.payoutProvider.initiateTransfer({
      amount: locked.netAmount.toString(),
      currency: 'NGN',
      reference: locked.reference,
      narration: `Cohold withdrawal ${locked.reference}`,
      accountNumber: bank.accountNumber,
      bankCode,
      accountName: bank.accountName,
    });

    return this.finalizeAfterProviderInitiate(locked.id, transfer);
  }

  /** If another worker already moved the row out of INITIATING, apply latest provider poll when possible. */
  private async resumeInitiatingWithdrawal(withdrawal: {
    id: string;
    status: WithdrawalStatus;
    providerTransferCode: string | null;
    linkedBankAccount: { bankCode: string | null; isVerified: boolean } | null;
  }) {
    if (withdrawal.providerTransferCode) {
      const snap = await this.payoutProvider.getTransferStatus(withdrawal.providerTransferCode);
      return this.applyProviderPollToWithdrawal(withdrawal.id, snap, 'resume-initiating');
    }
    return withdrawal;
  }

  private async finalizeAfterProviderInitiate(withdrawalId: string, transfer: InitiateTransferResult) {
    if (transfer.ambiguous || transfer.status === 'UNKNOWN') {
      return this.moveToReconciliationRequired(
        withdrawalId,
        transfer.failureReason ?? 'Ambiguous payout initiation (no definitive provider outcome)',
        {
          providerReference: transfer.providerReference,
          providerTransferCode: transfer.transferCode,
          providerStatus: transfer.rawStatus ?? transfer.status,
        },
      );
    }

    if (!transfer.accepted || transfer.status === 'FAILED') {
      return this.markFailed(
        withdrawalId,
        transfer.failureReason ?? 'Provider rejected transfer',
        transfer.providerReference,
        transfer.transferCode,
        { authoritative: true },
      );
    }

    const current = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!current) throw new NotFoundException('Withdrawal not found');
    if (current.status !== WithdrawalStatus.INITIATING) {
      return current;
    }

    this.assertTransition(current.status, WithdrawalStatus.PROCESSING);
    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.PROCESSING,
        processedAt: new Date(),
        providerReference: transfer.providerReference ?? current.providerReference,
        providerTransferCode: transfer.transferCode ?? current.providerTransferCode,
        providerStatus: transfer.rawStatus ?? transfer.status ?? null,
        providerLastCheckedAt: new Date(),
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

  private async moveToReconciliationRequired(
    withdrawalId: string,
    reason: string,
    opts?: {
      providerReference?: string | null;
      providerTransferCode?: string | null;
      providerStatus?: string | null;
    },
  ) {
    const row = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!row) throw new NotFoundException('Withdrawal not found');
    if (
      row.status === WithdrawalStatus.COMPLETED ||
      row.status === WithdrawalStatus.FAILED ||
      row.status === WithdrawalStatus.CANCELLED
    ) {
      return row;
    }
    if (row.status === WithdrawalStatus.RECONCILIATION_REQUIRED) {
      return this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          failureReason: reason.slice(0, 2000),
          providerReference: opts?.providerReference ?? row.providerReference ?? undefined,
          providerTransferCode: opts?.providerTransferCode ?? row.providerTransferCode ?? undefined,
          providerStatus: opts?.providerStatus ?? row.providerStatus ?? undefined,
          providerLastCheckedAt: new Date(),
          metadata: {
            ...(row.metadata as Record<string, unknown> | null),
            reconciliationRequiredAt:
              (row.metadata as Record<string, unknown> | null)?.reconciliationRequiredAt ??
              new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }
    this.assertTransition(row.status, WithdrawalStatus.RECONCILIATION_REQUIRED);
    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.RECONCILIATION_REQUIRED,
        failureReason: reason.slice(0, 2000),
        providerReference: opts?.providerReference ?? row.providerReference ?? undefined,
        providerTransferCode: opts?.providerTransferCode ?? row.providerTransferCode ?? undefined,
        providerStatus: opts?.providerStatus ?? row.providerStatus ?? undefined,
        providerLastCheckedAt: new Date(),
        metadata: {
          ...(row.metadata as Record<string, unknown> | null),
          reconciliationRequiredAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Shared path for webhooks, resume-initiating, scheduled reconciliation, and admin-triggered reconciliation.
   */
  async applyProviderPollToWithdrawal(
    withdrawalId: string,
    snap: TransferPollResult,
    source: string,
  ) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('Withdrawal not found');

    if (snap.status === 'SUCCESS') {
      return this.markCompleted(w.id, snap.providerReference, snap.transferCode, {
        lateSuccessOk: w.status === WithdrawalStatus.FAILED,
      });
    }

    if (snap.status === 'FAILED' && !snap.ambiguous) {
      return this.markFailed(
        withdrawalId,
        snap.failureReason ?? 'Provider reported transfer failure',
        snap.providerReference,
        snap.transferCode,
        { authoritative: true, source },
      );
    }

    if (snap.ambiguous || snap.status === 'UNKNOWN') {
      return this.moveToReconciliationRequired(
        withdrawalId,
        snap.failureReason ?? 'Provider status poll inconclusive',
        {
          providerReference: snap.providerReference,
          providerTransferCode: snap.transferCode,
          providerStatus: snap.rawStatus,
        },
      );
    }

    // PROCESSING / in-flight at provider
    if (w.status === WithdrawalStatus.COMPLETED || w.status === WithdrawalStatus.FAILED) {
      return w;
    }
    return this.markProcessing(
      withdrawalId,
      snap.providerReference,
      snap.transferCode,
      snap.rawStatus ?? undefined,
    );
  }

  async reconcileWithdrawalById(withdrawalId: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (!w.providerTransferCode) {
      throw new BadRequestException(
        'Withdrawal has no provider transfer id yet; automatic reconciliation requires Flutterwave transfer id',
      );
    }
    const snap = await this.payoutProvider.getTransferStatus(w.providerTransferCode);
    return this.applyProviderPollToWithdrawal(withdrawalId, snap, 'admin-reconcile');
  }

  async reconcileStaleWithdrawals(olderThanMinutes = 30, batchSize = 50) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stuck = await this.prisma.withdrawal.findMany({
      where: {
        status: {
          in: [
            WithdrawalStatus.INITIATING,
            WithdrawalStatus.PROCESSING,
            WithdrawalStatus.RECONCILIATION_REQUIRED,
          ],
        },
        updatedAt: { lt: cutoff },
      },
      take: batchSize,
      orderBy: { updatedAt: 'asc' },
    });

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const row of stuck) {
      try {
        if (!row.providerTransferCode) {
          await this.moveToReconciliationRequired(
            row.id,
            'Stuck withdrawal without provider transfer id — requires manual ops review',
            {},
          );
          results.push({ id: row.id, ok: true });
          continue;
        }
        await this.applyProviderPollToWithdrawal(
          row.id,
          await this.payoutProvider.getTransferStatus(row.providerTransferCode),
          'stale-reconcile',
        );
        results.push({ id: row.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`reconcileStaleWithdrawals failed for ${row.id}: ${msg}`);
        results.push({ id: row.id, ok: false, error: msg });
      }
    }
    return { scanned: stuck.length, results };
  }

  async adminListWithdrawals(params: {
    page: number;
    limit: number;
    status?: WithdrawalStatus;
    stuckOnly?: boolean;
    olderThanMinutes?: number;
  }) {
    const { page, limit, status, stuckOnly, olderThanMinutes = 60 } = params;
    const skip = (page - 1) * limit;
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

    const where: Prisma.WithdrawalWhereInput = {};
    if (stuckOnly) {
      where.AND = [
        {
          status: {
            in: [
              WithdrawalStatus.INITIATING,
              WithdrawalStatus.PROCESSING,
              WithdrawalStatus.RECONCILIATION_REQUIRED,
            ],
          },
        },
        { updatedAt: { lt: cutoff } },
      ];
    } else if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          reference: true,
          amount: true,
          currency: true,
          status: true,
          failureReason: true,
          providerReference: true,
          providerTransferCode: true,
          providerStatus: true,
          providerLastCheckedAt: true,
          reconciliationConflict: true,
          reconciliationConflictReason: true,
          reconciliationConflictAt: true,
          initiatedAt: true,
          processedAt: true,
          completedAt: true,
          updatedAt: true,
          linkedBankAccountId: true,
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        amount: row.amount.toString(),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async handlePayoutWebhook(payload: Record<string, unknown>) {
    const parsed = this.payoutProvider.parseTransferWebhook(payload);
    if (!parsed) return { received: true };

    const withdrawal = await this.findByProviderWebhook(parsed);
    if (!withdrawal) return { received: true };

    if (parsed.status === 'SUCCESS') {
      if (withdrawal.status === WithdrawalStatus.COMPLETED) return { received: true };
      await this.markCompleted(withdrawal.id, parsed.providerReference, parsed.transferCode, {
        lateSuccessOk: withdrawal.status === WithdrawalStatus.FAILED,
      });
      return { received: true };
    }

    if (parsed.status === 'FAILED') {
      await this.markFailed(
        withdrawal.id,
        parsed.failureReason ?? 'Provider reported payout failure',
        parsed.providerReference,
        parsed.transferCode,
        { authoritative: true, source: 'webhook' },
      );
      return { received: true };
    }

    if (parsed.status === 'UNKNOWN') {
      await this.moveToReconciliationRequired(
        withdrawal.id,
        parsed.failureReason ?? 'Provider webhook reported unknown transfer state',
        {
          providerReference: parsed.providerReference,
          providerTransferCode: parsed.transferCode,
        },
      );
      return { received: true };
    }

    if (parsed.status === 'PROCESSING') {
      if (
        withdrawal.status === WithdrawalStatus.PENDING ||
        withdrawal.status === WithdrawalStatus.INITIATING ||
        withdrawal.status === WithdrawalStatus.RECONCILIATION_REQUIRED
      ) {
        await this.markProcessing(withdrawal.id, parsed.providerReference, parsed.transferCode);
      }
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

  async markProcessing(
    id: string,
    providerReference?: string | null,
    providerTransferCode?: string | null,
    providerStatus?: string | null,
  ) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status === WithdrawalStatus.COMPLETED) return w;
    if (w.status === WithdrawalStatus.PROCESSING) {
      return this.prisma.withdrawal.update({
        where: { id },
        data: {
          providerReference: providerReference ?? w.providerReference ?? undefined,
          providerTransferCode: providerTransferCode ?? w.providerTransferCode ?? undefined,
          providerStatus: providerStatus ?? w.providerStatus ?? undefined,
          providerLastCheckedAt: new Date(),
        },
      });
    }
    this.assertTransition(w.status, WithdrawalStatus.PROCESSING);
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PROCESSING,
        processedAt: w.processedAt ?? new Date(),
        providerReference: providerReference ?? w.providerReference ?? undefined,
        providerTransferCode: providerTransferCode ?? w.providerTransferCode ?? undefined,
        providerStatus: providerStatus ?? w.providerStatus ?? undefined,
        providerLastCheckedAt: new Date(),
      },
    });
  }

  async markCompleted(
    id: string,
    providerReference?: string | null,
    providerTransferCode?: string | null,
    options?: { lateSuccessOk?: boolean },
  ) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status === WithdrawalStatus.COMPLETED) return w;

    if (w.status === WithdrawalStatus.RECONCILIATION_REQUIRED && w.reconciliationConflict) {
      return this.prisma.withdrawal.update({
        where: { id },
        data: {
          providerReference: providerReference ?? w.providerReference ?? undefined,
          providerTransferCode: providerTransferCode ?? w.providerTransferCode ?? undefined,
          providerStatus: 'SUCCESSFUL',
          providerLastCheckedAt: new Date(),
        },
      });
    }

    if (w.status === WithdrawalStatus.FAILED) {
      if (!options?.lateSuccessOk) {
        throw new BadRequestException('Withdrawal is failed; provider success requires reconciliation path');
      }
      const primaryRef = reversalReferenceFor(w.id);
      const legacyRef = `${w.reference}${REVERSAL_SUFFIX}`;
      const reversalLegs = await this.prisma.transaction.count({
        where: { reference: { in: [primaryRef, legacyRef] } },
      });
      if (reversalLegs >= 2) {
        this.logger.error(
          `CRITICAL reconciliation conflict persisted: withdrawal ${id} — provider SUCCESS after FAILED with reversal (ops / finance review).`,
        );
        this.assertTransition(w.status, WithdrawalStatus.RECONCILIATION_REQUIRED);
        return this.prisma.withdrawal.update({
          where: { id },
          data: {
            status: WithdrawalStatus.RECONCILIATION_REQUIRED,
            reconciliationConflict: true,
            reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
            reconciliationConflictAt: new Date(),
            completedAt: null,
            providerReference: providerReference ?? w.providerReference ?? undefined,
            providerTransferCode: providerTransferCode ?? w.providerTransferCode ?? undefined,
            providerStatus: 'SUCCESSFUL',
            providerLastCheckedAt: new Date(),
            metadata: {
              ...(w.metadata as Record<string, unknown> | null),
              lateProviderSuccessAfterReversalConflictAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    this.assertTransition(w.status, WithdrawalStatus.COMPLETED);
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.COMPLETED,
        completedAt: new Date(),
        processedAt: w.processedAt ?? new Date(),
        providerReference: providerReference ?? w.providerReference ?? undefined,
        providerTransferCode: providerTransferCode ?? w.providerTransferCode ?? undefined,
        providerStatus: 'SUCCESSFUL',
        providerLastCheckedAt: new Date(),
        metadata: {
          ...(w.metadata as Record<string, unknown> | null),
          ...(w.status === WithdrawalStatus.FAILED
            ? { lateProviderSuccessResolvedAt: new Date().toISOString() }
            : {}),
        } as Prisma.InputJsonValue,
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
    options?: { authoritative?: boolean; source?: string },
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

    const authoritative = options?.authoritative === true;
    if (!authoritative) {
      const transferId = providerTransferCode ?? w.providerTransferCode ?? null;
      if (transferId) {
        const snap = await this.payoutProvider.getTransferStatus(transferId);
        if (snap.status === 'SUCCESS') {
          return this.markCompleted(id, snap.providerReference, snap.transferCode, { lateSuccessOk: true });
        }
        if (snap.status === 'PROCESSING' || snap.ambiguous || snap.status === 'UNKNOWN') {
          return this.moveToReconciliationRequired(
            id,
            reason || 'Cannot confirm provider failure; reconciliation required',
            {
              providerReference: snap.providerReference ?? providerReference ?? w.providerReference,
              providerTransferCode: snap.transferCode ?? transferId,
              providerStatus: snap.rawStatus,
            },
          );
        }
      } else if (
        w.status === WithdrawalStatus.PROCESSING ||
        w.status === WithdrawalStatus.INITIATING ||
        w.status === WithdrawalStatus.RECONCILIATION_REQUIRED
      ) {
        return this.moveToReconciliationRequired(
          id,
          reason || 'Cannot confirm provider failure without transfer id',
          { providerReference: providerReference ?? w.providerReference },
        );
      }
    }

    this.assertTransition(w.status, WithdrawalStatus.FAILED);

    const amount = fixMoney(toDecimal(w.amount.toString()));
    const reversalReference = reversalReferenceFor(id);
    const legacyReversalReference = `${w.reference}${REVERSAL_SUFFIX}`;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.withdrawal.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Withdrawal not found');
      if (current.status === WithdrawalStatus.FAILED) return;
      if (current.status === WithdrawalStatus.COMPLETED) {
        throw new BadRequestException('Cannot fail a completed withdrawal');
      }

      const reversalLegsNew = await tx.transaction.findMany({ where: { reference: reversalReference } });
      const reversalLegsLegacy = await tx.transaction.findMany({
        where: { reference: legacyReversalReference },
      });
      const hasFullReversal =
        reversalLegsNew.length >= 2 || reversalLegsLegacy.length >= 2;

      if (reversalLegsNew.length === 1 || reversalLegsLegacy.length === 1) {
        throw new BadRequestException(
          `Corrupt withdrawal reversal reference for withdrawal ${id}: single-leg entry detected`,
        );
      }

      if (!hasFullReversal) {
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
        ], {
          operationType: LedgerOperationType.WITHDRAWAL_REVERSAL,
          sourceModule: 'withdrawal.markFailed',
          sourceId: current.id,
        });
      }

      await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: reason.slice(0, 2000),
          providerReference: providerReference ?? current.providerReference ?? undefined,
          providerTransferCode: providerTransferCode ?? current.providerTransferCode ?? undefined,
          providerStatus: 'FAILED',
          providerLastCheckedAt: new Date(),
          processedAt: current.processedAt ?? new Date(),
          metadata: {
            ...(current.metadata as Record<string, unknown> | null),
            reversalApplied: true,
            reversalReference,
            failureSource: options?.source ?? null,
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
      providerStatus?: string | null;
      providerLastCheckedAt?: Date | null;
      reconciliationConflict?: boolean;
      reconciliationConflictReason?: string | null;
      reconciliationConflictAt?: Date | null;
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
      providerStatus: w.providerStatus ?? null,
      providerLastCheckedAt: w.providerLastCheckedAt ?? null,
      reconciliationConflict: w.reconciliationConflict ?? false,
      reconciliationConflictReason: w.reconciliationConflictReason ?? null,
      reconciliationConflictAt: w.reconciliationConflictAt ?? null,
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
