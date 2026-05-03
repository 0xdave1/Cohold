import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletSwapDto } from './dto/wallet-swap.dto';
import { WalletDevCreditDto } from './dto/wallet-dev-credit.dto';
import {
  Currency,
  LedgerOperationType,
  Prisma,
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import Decimal from 'decimal.js';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SUPPORTED_CURRENCIES } from '../../common/constants/currency.constants';
import { fingerprintFromLegInputs, fingerprintFromPostedTransactions } from './ledger-fingerprint.util';

export type PostDoubleEntryOptions = {
  operationType: LedgerOperationType;
  sourceModule?: string;
  sourceId?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Money separation (production rules):
 * - **User wallets** (`Wallet` where `userId` is a real account): liquid balances only.
 * - **Platform** (`PLATFORM_USER_ID`): fees and platform revenue — never mixed with user cash in app logic.
 * - **Property escrow** (`ESCROW_PROPERTY_<propertyId>`): pooled principal for each listing — not user-spendable.
 * - **Investments** (`Investment`): positions (shares + principal `amount`); not a wallet.
 *
 * All movements are recorded in `Transaction` with `fee` / `netAmount` / `propertyId` / `investmentId` where applicable.
 *
 * Issue 1 — User-initiated wallet crediting is forbidden. NGN user-wallet credits must only
 * originate from verified provider settlement (`PaymentService.processWalletFunding`), future
 * admin-controlled tooling (not yet exposed), or `devCredit` in non-production.
 */
export const PLATFORM_USER_ID = 'PLATFORM_USER';
/** In-flight payout liquidity (withdrawals) — not user-spendable. */
export const SYSTEM_PAYOUT_USER_ID = 'SYSTEM_PAYOUT_USER';
const PROPERTY_ESCROW_PREFIX = 'ESCROW_PROPERTY_';
type TxClient = Pick<PrismaService, 'user' | 'wallet' | 'transaction'>;
type LedgerTxClient = Prisma.TransactionClient;
type LedgerLegInput = {
  walletId: string;
  userId?: string | null;
  type: TransactionType;
  direction: TransactionDirection;
  amount: Decimal;
  currency: Currency;
  externalReference?: string | null;
  propertyId?: string | null;
  investmentId?: string | null;
  fee?: Decimal | null;
  netAmount?: Decimal | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly walletCurrency = SUPPORTED_CURRENCIES[0];

  constructor(
    private readonly prisma: PrismaService,
    private readonly virtualAccountService: VirtualAccountService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getWalletBalance(walletId: string, tx?: Prisma.TransactionClient): Promise<Decimal> {
    const client = tx ?? this.prisma;
    const legs = await client.transaction.findMany({
      where: {
        walletId,
        status: TransactionStatus.COMPLETED,
      },
      select: {
        amount: true,
        direction: true,
      },
    });
    return legs.reduce((acc, leg) => {
      const amt = fixMoney(toDecimal(leg.amount.toString()));
      return leg.direction === TransactionDirection.CREDIT ? acc.plus(amt) : acc.minus(amt);
    }, new Decimal(0));
  }

  /**
   * Atomic double-entry with DB-enforced idempotency (`LedgerOperation.reference` unique).
   * Legacy rows (transactions without `ledgerOperationId`) are adopted once when fingerprint matches.
   */
  async postDoubleEntry(
    tx: LedgerTxClient,
    reference: string,
    legs: LedgerLegInput[],
    opts: PostDoubleEntryOptions,
  ): Promise<{ legs: Transaction[]; created: boolean }> {
    if (!reference?.trim()) {
      throw new BadRequestException('Ledger reference is required');
    }
    if (legs.length < 2) {
      throw new BadRequestException('A ledger reference group must contain at least two entries');
    }

    const currencies = new Set(legs.map((l) => l.currency));
    if (currencies.size !== 1) {
      throw new BadRequestException('All ledger legs must share the same currency');
    }
    const currency = legs[0].currency;

    for (const leg of legs) {
      if (!leg.walletId) {
        throw new BadRequestException('Every ledger entry must include walletId');
      }
      if (fixMoney(leg.amount).lte(0)) {
        throw new BadRequestException('Ledger leg amounts must be positive');
      }
    }

    const debitTotal = legs
      .filter((l) => l.direction === TransactionDirection.DEBIT)
      .reduce((acc, l) => acc.plus(fixMoney(l.amount)), new Decimal(0));
    const creditTotal = legs
      .filter((l) => l.direction === TransactionDirection.CREDIT)
      .reduce((acc, l) => acc.plus(fixMoney(l.amount)), new Decimal(0));
    if (!fixMoney(debitTotal).eq(fixMoney(creditTotal))) {
      throw new BadRequestException('Double-entry invariant failed: DEBIT total must equal CREDIT total');
    }

    const fingerprint = fingerprintFromLegInputs(legs);

    const walletIds = Array.from(new Set(legs.map((l) => l.walletId))).sort();
    for (const walletId of walletIds) {
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, walletId);
    }

    const existingOp = await tx.ledgerOperation.findUnique({
      where: { reference },
      include: { transactions: { orderBy: { ledgerLegIndex: 'asc' } } },
    });
    if (existingOp) {
      if (existingOp.legFingerprint !== fingerprint) {
        throw new ConflictException(
          `ledger_reference_conflict: reference=${reference} already posted with different economics`,
        );
      }
      if (existingOp.transactions.length !== legs.length) {
        throw new ConflictException(
          `ledger_reference_conflict: reference=${reference} has ${existingOp.transactions.length} legs, expected ${legs.length}`,
        );
      }
      return { legs: existingOp.transactions, created: false };
    }

    const legacyRows = await tx.transaction.findMany({
      where: {
        reference,
        ledgerOperationId: null,
        status: TransactionStatus.COMPLETED,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (legacyRows.length >= 2) {
      const legacyFp = fingerprintFromPostedTransactions(legacyRows);
      if (legacyFp !== fingerprint) {
        throw new ConflictException(
          `ledger_reference_conflict: reference=${reference} exists with different posted economics`,
        );
      }
      const op = await tx.ledgerOperation.create({
        data: {
          reference,
          type: LedgerOperationType.LEGACY_UNKNOWN,
          currency,
          totalAmount: moneyStr(fixMoney(debitTotal)),
          legFingerprint: fingerprint,
          metadata: {
            adoptedLegacy: true,
            intendedOperationType: opts.operationType,
            sourceModule: opts.sourceModule ?? null,
          } as Prisma.InputJsonValue,
          sourceModule: opts.sourceModule ?? null,
          sourceId: opts.sourceId ?? null,
        },
      });
      for (let i = 0; i < legacyRows.length; i++) {
        await tx.transaction.update({
          where: { id: legacyRows[i].id },
          data: { ledgerOperationId: op.id, ledgerLegIndex: i },
        });
      }
      const linked = await tx.transaction.findMany({
        where: { ledgerOperationId: op.id },
        orderBy: { ledgerLegIndex: 'asc' },
      });
      return { legs: linked, created: false };
    }
    if (legacyRows.length === 1) {
      throw new BadRequestException(
        `Corrupt ledger group for reference ${reference}: expected at least 2 entries`,
      );
    }

    let ledgerOperationId: string;
    try {
      const op = await tx.ledgerOperation.create({
        data: {
          reference,
          type: opts.operationType,
          currency,
          totalAmount: moneyStr(fixMoney(debitTotal)),
          legFingerprint: fingerprint,
          metadata: opts.metadata ?? Prisma.JsonNull,
          sourceModule: opts.sourceModule ?? null,
          sourceId: opts.sourceId ?? null,
        },
      });
      ledgerOperationId = op.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await tx.ledgerOperation.findUnique({
          where: { reference },
          include: { transactions: { orderBy: { ledgerLegIndex: 'asc' } } },
        });
        if (!raced || raced.legFingerprint !== fingerprint || raced.transactions.length !== legs.length) {
          throw new ConflictException(
            `ledger_reference_conflict: concurrent post for reference=${reference} could not be reconciled`,
          );
        }
        return { legs: raced.transactions, created: false };
      }
      throw e;
    }

    for (let idx = 0; idx < legs.length; idx++) {
      const leg = legs[idx];
      await tx.transaction.create({
        data: {
          walletId: leg.walletId,
          userId: leg.userId ?? null,
          reference,
          groupId: reference,
          externalReference: leg.externalReference ?? null,
          type: leg.type,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(fixMoney(leg.amount)),
          fee: leg.fee != null ? moneyStr(fixMoney(leg.fee)) : null,
          netAmount: leg.netAmount != null ? moneyStr(fixMoney(leg.netAmount)) : null,
          currency: leg.currency,
          direction: leg.direction,
          metadata: ({
            ...(leg.metadata as Record<string, unknown> | undefined),
            ledgerReference: reference,
            ledgerIndex: idx,
          } as Prisma.InputJsonValue),
          propertyId: leg.propertyId ?? null,
          investmentId: leg.investmentId ?? null,
          ledgerOperationId,
          ledgerLegIndex: idx,
        },
      });
    }

    const deltas = new Map<string, Decimal>();
    for (const leg of legs) {
      const signed =
        leg.direction === TransactionDirection.CREDIT ? fixMoney(leg.amount) : fixMoney(leg.amount).neg();
      deltas.set(leg.walletId, fixMoney((deltas.get(leg.walletId) ?? new Decimal(0)).plus(signed)));
    }

    const sortedWalletIds = Array.from(deltas.keys()).sort();
    for (const walletId of sortedWalletIds) {
      const net = deltas.get(walletId)!;
      if (net.lt(0)) {
        await this.applyWalletBalanceDelta(tx, walletId, net);
      }
    }
    for (const walletId of sortedWalletIds) {
      const net = deltas.get(walletId)!;
      if (net.gt(0)) {
        await this.applyWalletBalanceDelta(tx, walletId, net);
      }
    }

    const posted = await tx.transaction.findMany({
      where: { ledgerOperationId },
      orderBy: { ledgerLegIndex: 'asc' },
    });
    return { legs: posted, created: true };
  }

  private async applyWalletBalanceDelta(tx: LedgerTxClient, walletId: string, delta: Decimal) {
    const d = fixMoney(delta);
    if (d.eq(0)) {
      return;
    }
    const absStr = moneyStr(d.abs());
    if (d.gt(0)) {
      const n = await tx.$executeRawUnsafe(
        `UPDATE "Wallet" SET balance = balance + $1::decimal(19,4), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
        absStr,
        walletId,
      );
      if (Number(n) !== 1) {
        throw new BadRequestException('Wallet balance update failed (credit)');
      }
      return;
    }
    const n = await tx.$executeRawUnsafe(
      `UPDATE "Wallet" SET balance = balance - $1::decimal(19,4), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2::uuid AND balance >= $1::decimal(19,4)`,
      absStr,
      walletId,
    );
    if (Number(n) !== 1) {
      throw new BadRequestException('Insufficient wallet balance for ledger debit');
    }
  }

  async getBalances(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, currency: this.walletCurrency },
      select: { id: true, currency: true, balance: true },
    });
    return wallets.map((w) => ({
      id: w.id,
      currency: w.currency,
      balance: formatMoney(toDecimal(w.balance.toString())),
    }));
  }

  async getVirtualAccounts(userId: string) {
    const accounts = await this.prisma.virtualAccount.findMany({
      where: { userId },
      select: { id: true, accountNumber: true, accountName: true, bankName: true, currency: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Cohold User';
    return accounts.map((a) => ({
      id: a.id,
      accountNumber: a.accountNumber,
      bankName: a.bankName,
      currency: a.currency,
      accountName: a.accountName || fallbackName,
    }));
  }

  /**
   * Create a dedicated virtual account for a verified user.
   * Delegates to VirtualAccountService (Paystack dedicated account integration).
   */
  async createVirtualAccount(userId: string) {
    return this.virtualAccountService.createVirtualAccountForUser(userId);
  }

  async getAccountDetails(userId: string, currency: Currency = Currency.NGN) {
    if (currency !== this.walletCurrency) {
      throw new BadRequestException('Only NGN wallet account details are supported for now');
    }
    const account = await this.prisma.virtualAccount.findFirst({
      where: { userId, currency },
      select: { accountNumber: true, bankName: true, accountName: true, currency: true },
    });

    if (!account) {
      throw new NotFoundException('Virtual account not found');
    }

    return account;
  }

  async getTransactions(
    userId: string,
    opts: {
      page: number;
      limit: number;
      type?: string;
      status?: string;
      direction?: string;
      currency?: string;
      q?: string;
    },
  ) {
    const page = Number.isFinite(opts.page) && opts.page > 0 ? opts.page : 1;
    const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.min(opts.limit, 50) : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (opts.type) where.type = opts.type as TransactionType;
    if (opts.status) where.status = opts.status as TransactionStatus;
    if (opts.direction) where.direction = opts.direction as TransactionDirection;
    if (opts.currency) {
      if ((opts.currency as Currency) !== this.walletCurrency) {
        throw new BadRequestException('Only NGN transactions are supported for now');
      }
      where.currency = this.walletCurrency;
    }
    if (opts.q) where.reference = { contains: opts.q, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          direction: true,
          createdAt: true,
          ledgerOperationId: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        reference: t.reference,
        type: t.type,
        status: t.status,
        amount: t.amount.toString(),
        currency: t.currency,
        direction: t.direction,
        createdAt: t.createdAt,
        ledgerOperationId: t.ledgerOperationId ?? null,
      })),
      meta: { page, limit, total },
    };
  }

  /** Get or create property escrow wallet for funding. Must be called within a Prisma transaction. */
  async getPropertyEscrowWallet(tx: TxClient, propertyId: string, currency: Currency) {
    const escrowUserId = `${PROPERTY_ESCROW_PREFIX}${propertyId}`;
    await tx.user.upsert({
      where: { id: escrowUserId },
      create: {
        id: escrowUserId,
        email: `escrow-${propertyId}@internal.cohold`,
        passwordHash: 'ESCROW_NO_LOGIN',
      },
      update: {},
    });
    return tx.wallet.upsert({
      where: { userId_currency: { userId: escrowUserId, currency } },
      create: { userId: escrowUserId, currency, balance: '0' },
      update: {},
    });
  }

  /** Ensure platform wallet exists */
  async getPlatformWallet(tx: TxClient, currency: Currency) {
    await tx.user.upsert({
      where: { id: PLATFORM_USER_ID },
      create: {
        id: PLATFORM_USER_ID,
        email: 'platform@internal.cohold',
        passwordHash: 'PLATFORM_NO_LOGIN',
      },
      update: {},
    });

    return tx.wallet.upsert({
      where: { userId_currency: { userId: PLATFORM_USER_ID, currency } },
      create: { userId: PLATFORM_USER_ID, currency, balance: '0' },
      update: {},
    });
  }

  /** Clearing wallet for in-flight bank payouts (withdrawals). */
  async getPayoutWallet(tx: TxClient, currency: Currency) {
    await tx.user.upsert({
      where: { id: SYSTEM_PAYOUT_USER_ID },
      create: {
        id: SYSTEM_PAYOUT_USER_ID,
        email: 'payout-clearing@internal.cohold',
        passwordHash: 'PAYOUT_NO_LOGIN',
      },
      update: {},
    });
    return tx.wallet.upsert({
      where: { userId_currency: { userId: SYSTEM_PAYOUT_USER_ID, currency } },
      create: { userId: SYSTEM_PAYOUT_USER_ID, currency, balance: '0' },
      update: {},
    });
  }

  /**
   * Internal only: move value from platform synthetic wallet to a user wallet.
   * `reference` and `userCreditReason` must be server-controlled — never from HTTP DTOs.
   * Verified Flutterwave funding does not use this path; it uses `PaymentService.processWalletFunding`.
   */
  private async applyTrustedPlatformToUserCredit(
    userId: string,
    amount: Decimal,
    params: { reference: string; userCreditReason: 'dev_wallet_credit' },
  ) {
    const amt = fixMoney(amount);
    if (amt.lte(0)) throw new BadRequestException('Amount must be positive');

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: this.walletCurrency },
    });
    if (!wallet) throw new NotFoundException('Wallet not found for currency');

    const result = await this.prisma.$transaction(async (tx) => {
      const reference = params.reference;
      const platformWallet = await this.getPlatformWallet(tx, this.walletCurrency);
      const { created } = await this.postDoubleEntry(tx, reference, [
        {
          walletId: platformWallet.id,
          userId: PLATFORM_USER_ID,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.DEBIT,
          amount: amt,
          currency: this.walletCurrency,
          netAmount: amt,
          metadata: { reason: 'trusted_platform_debit', groupId: reference } as Prisma.InputJsonValue,
        },
        {
          walletId: wallet.id,
          userId,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.CREDIT,
          amount: amt,
          currency: this.walletCurrency,
          netAmount: amt,
          metadata: {
            reason: params.userCreditReason,
            groupId: reference,
          } as Prisma.InputJsonValue,
        },
      ], {
        operationType: LedgerOperationType.DEV_CREDIT,
        sourceModule: 'wallet.applyTrustedPlatformToUserCredit',
        sourceId: reference,
        metadata: { userCreditReason: params.userCreditReason } as Prisma.InputJsonValue,
      });

      const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!updatedWallet) throw new NotFoundException('Wallet not found');
      return { updatedWallet, didCredit: created, reference, amount: amt };
    });

    if (result.didCredit) {
      try {
        await this.notificationsService.notifyWalletFunded(
          userId,
          formatMoney(result.amount),
          result.updatedWallet.currency,
          result.reference,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create wallet funded notification userId=${userId} ref=${result.reference}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return {
      walletId: result.updatedWallet.id,
      currency: result.updatedWallet.currency,
      balance: formatMoney(toDecimal(result.updatedWallet.balance.toString())),
      transactionReference: result.reference,
    };
  }

  /**
   * Dev/test-only: synthetic credit via platform wallet. Forbidden in production at
   * service layer (defense in depth with `WalletController`). Never call from webhooks,
   * `PaymentService`, or investment flows.
   */
  async devCredit(userId: string, dto: WalletDevCreditDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev wallet credit is disabled in production');
    }
    if (dto.currency !== this.walletCurrency) {
      throw new BadRequestException('Only NGN dev credits are supported for now');
    }
    const amount = toDecimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');
    const ref = `DEV-${Date.now()}-${randomUUID()}`;
    return this.applyTrustedPlatformToUserCredit(userId, amount, {
      reference: ref,
      userCreditReason: 'dev_wallet_credit',
    });
  }

  /** Swap currencies safely with NGN fee. Platform receives fee when NGN is involved. */
  async swap(userId: string, dto: WalletSwapDto) {
    void userId;
    void dto;
    throw new BadRequestException('Swap feature coming soon');
  }

  /**
   * Receipt / audit view: resolves all ledger legs sharing `groupId` (or legacy reference prefix).
   */
  async getTransactionReceipt(userId: string, reference: string) {
    const decoded = decodeURIComponent(reference.trim());
    const seed = await this.prisma.transaction.findFirst({
      where: { OR: [{ reference: decoded }, { groupId: decoded }] },
    });
    if (!seed) {
      throw new NotFoundException('Transaction not found');
    }
    const groupId = seed.reference;
    const legs = await this.prisma.transaction.findMany({
      where: {
        OR: [{ groupId }, { reference: groupId }, { reference: { startsWith: `${groupId}-` } }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        property: { select: { id: true, title: true, currency: true } },
      },
    });

    const authorized = legs.some((t) => t.userId === userId);
    if (!authorized) {
      throw new ForbiddenException('Not allowed to view this transaction');
    }

    const primary =
      legs.find((t) => t.userId === userId && t.type !== TransactionType.FEE) ??
      legs.find((t) => t.userId === userId);

    const meta = (primary?.metadata ?? {}) as Record<string, unknown>;

    return {
      reference: groupId,
      groupId,
      type: primary?.type,
      status: primary?.status,
      amount: primary?.amount?.toString(),
      fee: primary?.fee?.toString() ?? null,
      netAmount: primary?.netAmount?.toString() ?? null,
      currency: primary?.currency,
      propertyId: primary?.propertyId,
      investmentId: primary?.investmentId,
      shares: (meta.shares ?? meta.sharesToSell ?? null) as string | null,
      costBasis: (meta.costBasis ?? null) as string | null,
      profit: (meta.profit ?? null) as string | null,
      createdAt: primary?.createdAt,
      updatedAt: primary?.updatedAt,
      legs: legs.map((l) => ({
        id: l.id,
        reference: l.reference,
        groupId: l.groupId,
        type: l.type,
        direction: l.direction,
        amount: l.amount.toString(),
        fee: l.fee?.toString() ?? null,
        netAmount: l.netAmount?.toString() ?? null,
      })),
      metadata: primary?.metadata ?? null,
    };
  }

}