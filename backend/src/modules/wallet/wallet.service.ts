import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletTopUpDto } from './dto/wallet-top-up.dto';
import { WalletSwapDto } from './dto/wallet-swap.dto';
import { WalletDevCreditDto } from './dto/wallet-dev-credit.dto';
import {
  Currency,
  Prisma,
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

/**
 * Money separation (production rules):
 * - **User wallets** (`Wallet` where `userId` is a real account): liquid balances only.
 * - **Platform** (`PLATFORM_USER_ID`): fees and platform revenue — never mixed with user cash in app logic.
 * - **Property escrow** (`ESCROW_PROPERTY_<propertyId>`): pooled principal for each listing — not user-spendable.
 * - **Investments** (`Investment`): positions (shares + principal `amount`); not a wallet.
 *
 * All movements are recorded in `Transaction` with `fee` / `netAmount` / `propertyId` / `investmentId` where applicable.
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

  async postDoubleEntry(
    tx: LedgerTxClient,
    reference: string,
    legs: LedgerLegInput[],
  ) {
    if (!reference?.trim()) {
      throw new BadRequestException('Ledger reference is required');
    }
    if (legs.length < 2) {
      throw new BadRequestException('A ledger reference group must contain at least two entries');
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
    if (legs.some((l) => !l.walletId)) {
      throw new BadRequestException('Every ledger entry must include walletId');
    }

    const existingLegs = await tx.transaction.findMany({ where: { reference } });
    if (existingLegs.length >= 2) {
      return existingLegs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    if (existingLegs.length === 1) {
      throw new BadRequestException(
        `Corrupt ledger group for reference ${reference}: expected at least 2 entries`,
      );
    }

    const walletIds = Array.from(new Set(legs.map((l) => l.walletId))).sort();
    for (const walletId of walletIds) {
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, walletId);
    }

    await tx.transaction.createMany({
      data: legs.map((leg, idx) => ({
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
      })),
    });

    const deltas = new Map<string, Decimal>();
    for (const leg of legs) {
      const signed = leg.direction === TransactionDirection.CREDIT ? fixMoney(leg.amount) : fixMoney(leg.amount).neg();
      deltas.set(leg.walletId, fixMoney((deltas.get(leg.walletId) ?? new Decimal(0)).plus(signed)));
    }

    for (const [walletId, delta] of deltas.entries()) {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
      const next = fixMoney(toDecimal(wallet.balance.toString()).plus(delta));
      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: moneyStr(next) },
      });
    }

    return tx.transaction.findMany({ where: { reference }, orderBy: { createdAt: 'asc' } });
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

  /** Top-up wallet safely */
  async topUp(userId: string, dto: WalletTopUpDto) {
    if (dto.currency !== this.walletCurrency) {
      throw new BadRequestException('Only NGN top-ups are supported for now');
    }
    const amount = toDecimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency: this.walletCurrency },
    });
    if (!wallet) throw new NotFoundException('Wallet not found for currency');

    const result = await this.prisma.$transaction(async (tx) => {
      const reference = dto.clientReference ?? `TOPUP-${Date.now()}-${wallet.id}`;
      const amt = fixMoney(amount);

      // Idempotency by grouping reference.
      const existingLegs = await tx.transaction.findMany({
        where: { reference },
        orderBy: { createdAt: 'asc' },
      });
      if (existingLegs.length > 0) {
        const currentWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
        if (!currentWallet) throw new NotFoundException('Wallet not found');
        return { updatedWallet: currentWallet, didCredit: false, reference, amount: amt };
      }

      const platformWallet = await this.getPlatformWallet(tx, this.walletCurrency);
      await this.postDoubleEntry(tx, reference, [
        {
          walletId: platformWallet.id,
          userId: PLATFORM_USER_ID,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.DEBIT,
          amount: amt,
          currency: this.walletCurrency,
          netAmount: amt,
          metadata: { reason: 'topup_funding_source', groupId: reference } as Prisma.InputJsonValue,
        },
        {
          walletId: wallet.id,
          userId,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.CREDIT,
          amount: amt,
          currency: this.walletCurrency,
          netAmount: amt,
          metadata: { reason: dto.reason ?? 'manual_or_alt_rail_topup', groupId: reference } as Prisma.InputJsonValue,
        },
      ]);

      const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!updatedWallet) throw new NotFoundException('Wallet not found');
      return { updatedWallet, didCredit: true, reference, amount: amt };
    });

    if (result.didCredit) {
      const txMetaReason = dto.reason ?? 'manual_or_alt_rail_topup';
      // Investment checkout flow pre-credits the wallet before createFractional; avoid duplicate WALLET_FUNDED.
      if (txMetaReason !== 'investment_checkout_success') {
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
    }

    return {
      walletId: result.updatedWallet.id,
      currency: result.updatedWallet.currency,
      balance: formatMoney(toDecimal(result.updatedWallet.balance.toString())),
      transactionReference: result.reference,
    };
  }

  /**
   * Credit user wallet by reference (idempotent when reference matches existing transaction).
   * Used by payment webhooks and dev tooling.
   */
  async credit(
    userId: string,
    params: {
      amount: string;
      currency: Currency;
      reference: string;
      reason?: string;
    },
  ) {
    if (params.currency !== this.walletCurrency) {
      throw new BadRequestException('Only NGN credits are supported for now');
    }
    return this.topUp(userId, {
      currency: this.walletCurrency,
      amount: params.amount,
      clientReference: params.reference,
      reason: params.reason ?? 'wallet_credit',
    });
  }

  /** Dev-only direct credit (non-production). */
  async devCredit(userId: string, dto: WalletDevCreditDto) {
    const ref = `DEV-${Date.now()}-${randomUUID()}`;
    return this.credit(userId, {
      amount: dto.amount,
      currency: dto.currency,
      reference: ref,
      reason: 'dev_wallet_credit',
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