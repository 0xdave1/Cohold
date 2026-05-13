import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminAccountStatus,
  AdminRole,
  DistributionBatchStatus,
  KycStatus,
  Prisma,
  PrismaClient,
  PropertyStatus,
  SupportStatus,
  TransactionStatus,
  TransactionType,
  VirtualAccountStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { redactJsonForAuditPersistence } from '../../common/logging/security-redaction.util';
import { PrismaService } from '../../prisma/prisma.service';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { LedgerReconciliationService } from '../wallet/ledger-reconciliation.service';
import { StorageService } from '../storage/storage.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { assertValidUpload, extensionFromFileName } from '../storage/upload-validation';
import { KycService } from '../kyc/kyc.service';
import { KycReviewDto } from '../kyc/dto/kyc-review.dto';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';
import * as bcrypt from 'bcrypt';

type AdminUiRole = 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
type AdminUiStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
const MAX_ADMIN_LIST_LIMIT = 100;

/** Prisma interactive transaction client (subset of PrismaClient). */
type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>;

type AdminRequestAudit = { ipAddress?: string | null; userAgent?: string | null };

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly withdrawalService: WithdrawalService,
    private readonly ledgerReconciliation: LedgerReconciliationService,
    private readonly kycService: KycService,
    private readonly virtualAccountService: VirtualAccountService,
  ) {}

  private normalizePagination(page: number, limit: number, defaultLimit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const rawLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : defaultLimit;
    const safeLimit = Math.max(1, Math.min(MAX_ADMIN_LIST_LIMIT, rawLimit));
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  private ensureReason(reason?: string) {
    const normalized = reason?.trim();
    if (!normalized) {
      throw new BadRequestException('Reason is required.');
    }
    if (normalized.length < 5) {
      throw new BadRequestException('Reason must be at least 5 characters.');
    }
    if (normalized.length > 500) {
      throw new BadRequestException('Reason must be at most 500 characters.');
    }
    return normalized;
  }

  private maskAccountNumber(value?: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (!digits) return null;
    const last4 = digits.slice(-4);
    return `****${last4}`;
  }

  private toJsonValue(v: unknown): Prisma.InputJsonValue | undefined {
    if (v === undefined) return undefined;
    return redactJsonForAuditPersistence(v) as Prisma.InputJsonValue;
  }

  /**
   * Central audit writer — metadata/previous/next are always redacted before persistence (Issue 11).
   * Call inside the same DB transaction as the mutation when the action must roll back if audit fails.
   */
  private async writeAdminActivityLog(
    tx: PrismaTransaction,
    params: {
      adminId: string;
      action: string;
      entityType: string;
      entityId?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      reason?: string | null;
      metadata?: unknown;
      previousValue?: unknown;
      nextValue?: unknown;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const actor = await tx.admin.findUnique({
      where: { id: params.adminId },
      select: { role: true },
    });
    await tx.adminActivityLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata !== undefined ? this.toJsonValue(params.metadata) : undefined,
        previousValue: params.previousValue !== undefined ? this.toJsonValue(params.previousValue) : undefined,
        nextValue: params.nextValue !== undefined ? this.toJsonValue(params.nextValue) : undefined,
        actorAdminId: params.adminId,
        actorRole: actor?.role ?? null,
        targetType: params.targetType ?? params.entityType,
        targetId: params.targetId ?? params.entityId ?? null,
        reason: params.reason ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  private dbTx(): PrismaTransaction {
    return this.prisma as unknown as PrismaTransaction;
  }

  /** Ensures at least one other ACTIVE SUPER_ADMIN remains if `affectedId` is currently an active super admin. */
  private async assertRetainsSuperAdminCoverage(tx: PrismaTransaction, affectedAdminId: string) {
    const target = await tx.admin.findUnique({
      where: { id: affectedAdminId },
      select: { role: true, accountStatus: true },
    });
    if (!target || target.role !== AdminRole.SUPER_ADMIN || target.accountStatus !== AdminAccountStatus.ACTIVE) {
      return;
    }
    const others = await tx.admin.count({
      where: {
        role: AdminRole.SUPER_ADMIN,
        accountStatus: AdminAccountStatus.ACTIVE,
        id: { not: affectedAdminId },
      },
    });
    if (others < 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last active Super admin. Activate or promote another Super admin first.',
      );
    }
  }

  async getDashboardOverview() {
    const [totalInvestmentsAmount, usersCount, activeInvestorsCount, properties] =
      await Promise.all([
        this.prisma.investment.aggregate({
          _sum: { amount: true },
        }),
        this.prisma.user.count(),
        this.prisma.investment
          .groupBy({
            by: ['userId'],
          })
          .then((rows) => rows.length),
        this.prisma.property.findMany({
          select: {
            id: true,
            title: true,
            status: true,
            currentRaised: true,
            totalValue: true,
          },
        }),
      ]);

    const totalAum = totalInvestmentsAmount._sum.amount
      ? formatMoney(toDecimal(totalInvestmentsAmount._sum.amount.toString()))
      : '0.0000';

    return {
      totalAum,
      usersCount,
      activeInvestorsCount,
      properties,
    };
  }

  async listUsers(params: {
    page: number;
    limit: number;
    kycStatus?: string;
  }) {
    const { kycStatus } = params;
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);

    const where: any = {};
    if (kycStatus) {
      if (!Object.values(KycStatus).includes(kycStatus as KycStatus)) {
        throw new BadRequestException('Invalid kycStatus filter');
      }
      where.kycStatus = kycStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          phoneNumber: true,
          phoneCountryCode: true,
          nationality: true,
          kycStatus: true,
          isFrozen: true,
          onboardingCompletedAt: true,
          createdAt: true,
          updatedAt: true,
          virtualAccounts: {
            where: { status: VirtualAccountStatus.ACTIVE },
            select: { accountNumber: true },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        accountNumber: this.maskAccountNumber(u.virtualAccounts?.[0]?.accountNumber ?? null),
        virtualAccounts: undefined,
      })),
      meta: { page, limit, total },
    };
  }

  async getDashboardOverviewV2() {
    const [
      usersCount,
      verifiedUsers,
      pendingKyc,
      rejectedOrReviewKyc,
      frozenUsers,
      propertiesByStatus,
      walletAggregates,
      investmentAggregates,
      totalInvestmentsCount,
      walletFundingVolumeAggregate,
      withdrawalsByStatus,
      virtualAccountsByStatus,
      distributionByStatus,
      outboxByStatus,
      supportByStatus,
      disputesCount,
      ledgerReport,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { kycStatus: KycStatus.VERIFIED } }),
      this.prisma.user.count({ where: { kycStatus: KycStatus.PENDING } }),
      this.prisma.user.count({ where: { kycStatus: { in: [KycStatus.FAILED, KycStatus.REQUIRES_REVIEW] } } }),
      this.prisma.user.count({ where: { isFrozen: true } }),
      this.prisma.property.groupBy({ by: ['status'], _count: true }),
      this.prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } }),
      this.prisma.investment.groupBy({ by: ['currency'], _sum: { amount: true } }),
      this.prisma.investment.count(),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.WALLET_TOP_UP, status: TransactionStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.withdrawal.groupBy({ by: ['status'], _count: true }),
      this.prisma.virtualAccount.groupBy({ by: ['status'], _count: true }),
      this.prisma.distributionBatch.groupBy({ by: ['status'], _count: true }),
      this.prisma.outboxEvent.groupBy({ by: ['status'], _count: true }),
      this.prisma.supportConversation.groupBy({ by: ['status'], _count: true }),
      this.prisma.supportConversation.count({ where: { isDispute: true, status: { in: ['OPEN', 'LIVE', 'WAITING_FOR_ADMIN', 'WAITING_FOR_USER'] } } }),
      this.ledgerReconciliation.buildReport(),
    ]);

    const walletBalances: Record<string, string> = {};
    for (const w of walletAggregates) {
      walletBalances[w.currency] = w._sum.balance?.toString() ?? '0';
    }

    const totalInvestments: Record<string, string> = {};
    for (const inv of investmentAggregates) {
      totalInvestments[inv.currency] = inv._sum.amount?.toString() ?? '0';
    }

    const byStatusCount = <T extends string>(rows: Array<{ status: T; _count: number }>, key: T) =>
      rows.find((row) => row.status === key)?._count ?? 0;

    const activeListings = byStatusCount(propertiesByStatus as any, PropertyStatus.PUBLISHED as any);
    const pendingListings = byStatusCount(propertiesByStatus as any, PropertyStatus.DRAFT as any);
    const withdrawalPending = byStatusCount(withdrawalsByStatus as any, WithdrawalStatus.PENDING as any);
    const withdrawalProcessing =
      byStatusCount(withdrawalsByStatus as any, WithdrawalStatus.INITIATING as any) +
      byStatusCount(withdrawalsByStatus as any, WithdrawalStatus.PROCESSING as any);
    const withdrawalRecon = byStatusCount(withdrawalsByStatus as any, WithdrawalStatus.RECONCILIATION_REQUIRED as any);
    const withdrawalFailed = byStatusCount(withdrawalsByStatus as any, WithdrawalStatus.FAILED as any);
    const vaActive = byStatusCount(virtualAccountsByStatus as any, VirtualAccountStatus.ACTIVE as any);
    const vaFailed =
      byStatusCount(virtualAccountsByStatus as any, VirtualAccountStatus.FAILED as any) +
      byStatusCount(virtualAccountsByStatus as any, VirtualAccountStatus.REQUIRES_RETRY as any);
    const outboxPending = byStatusCount(outboxByStatus as any, 'PENDING' as any);
    const outboxDeadLetter = byStatusCount(outboxByStatus as any, 'DEAD_LETTER' as any);
    const supportOpen = supportByStatus
      .filter((row) => ['OPEN', 'LIVE', 'WAITING_FOR_ADMIN', 'WAITING_FOR_USER'].includes(String(row.status)))
      .reduce((sum, row) => sum + row._count, 0);
    const distributionPending = byStatusCount(distributionByStatus as any, DistributionBatchStatus.DRAFT as any);
    const distributionProcessing = byStatusCount(distributionByStatus as any, DistributionBatchStatus.PROCESSING as any);
    const distributionPartialFailed = byStatusCount(distributionByStatus as any, DistributionBatchStatus.PARTIALLY_FAILED as any);
    const ledgerMismatchCount =
      ledgerReport.walletBalanceMismatches.length +
      ledgerReport.unbalancedLedgerOperations.length +
      ledgerReport.shortLedgerOperations.length +
      ledgerReport.transactionsWithoutLedgerOperation;

    return {
      totalUsers: usersCount,
      totalVerifiedUsers: verifiedUsers,
      totalUnverifiedUsers: usersCount - verifiedUsers,
      pendingKyc,
      rejectedOrReviewKyc,
      frozenUsers,
      totalCoholds: null,
      totalInvestments: { NGN: '0', USD: '0', GBP: '0', EUR: '0', ...totalInvestments },
      walletBalances: { NGN: '0', USD: '0', GBP: '0', EUR: '0', ...walletBalances },
      totalInvestmentsCount,
      totalInvestedAmount: Object.values(totalInvestments).reduce((acc, v) => acc.plus(toDecimal(v)), toDecimal(0)).toString(),
      walletFundingVolume: walletFundingVolumeAggregate._sum.amount?.toString() ?? '0',
      activeListings,
      pendingListings,
      fractionalListings: null,
      landListings: null,
      ownAHomeListings: null,
      coholdRevenue: null,
      withdrawals: {
        pending: withdrawalPending,
        processing: withdrawalProcessing,
        reconciliationRequired: withdrawalRecon,
        failed: withdrawalFailed,
      },
      virtualAccounts: {
        active: vaActive,
        failedOrRetryRequired: vaFailed,
      },
      ledgerReconciliationMismatchCount: ledgerMismatchCount,
      outbox: { pending: outboxPending, deadLetter: outboxDeadLetter },
      distributions: {
        pending: distributionPending,
        processing: distributionProcessing,
        partiallyFailed: distributionPartialFailed,
      },
      supportOpenConversations: supportOpen,
      openDisputes: disputesCount,
      unsupported: {
        totalCoholds: 'No cohold aggregate model available.',
        coholdRevenue: 'No durable fee/revenue ledger aggregate available in admin overview.',
        listingTypeBreakdown: 'Property type taxonomy is not modeled explicitly.',
      },
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: { select: { id: true, currency: true, balance: true } },
        investments: {
          select: { id: true, propertyId: true, amount: true, currency: true, shares: true, status: true },
        },
        kycVerification: true,
        virtualAccounts: {
          select: {
            id: true,
            status: true,
            accountNumber: true,
            bankName: true,
            accountName: true,
            currency: true,
            failureReason: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!user) throw new Error('User not found');

    const totalInvested = user.investments.reduce(
      (acc, inv) => acc.plus(toDecimal(inv.amount.toString())),
      toDecimal(0),
    );
    const walletBalance = user.wallets.reduce(
      (acc, w) => acc.plus(toDecimal(w.balance.toString())),
      toDecimal(0),
    );

    const { passwordHash: _pw, kycVerification, ...safeUser } = user;

    const profilePhotoUrl = safeUser.profilePhotoKey
      ? await this.storage.createSignedReadUrl(safeUser.profilePhotoKey, 300).catch(() => null)
      : null;

    const kycForAdmin = kycVerification
      ? {
          ...this.kycService.sanitizeKycRecordForResponse(kycVerification),
          // Sensitive media object keys/urls are exposed via dedicated signed-read endpoint only.
          documentFrontUrl: null,
          documentBackUrl: null,
          selfieUrl: null,
          documentLegacyUrl: null,
        }
      : null;

    return {
      ...safeUser,
      profilePhotoUrl,
      wallets: user.wallets.map((w) => ({ ...w, balance: w.balance.toString() })),
      investments: user.investments.map((inv) => ({
        ...inv,
        amount: inv.amount.toString(),
        shares: inv.shares.toString(),
      })),
      linkedBanks: [],
      kycVerification: kycForAdmin,
      virtualAccount: user.virtualAccounts?.[0]
        ? {
            ...user.virtualAccounts[0],
            accountNumber: this.maskAccountNumber(user.virtualAccounts[0].accountNumber),
          }
        : null,
      totalInvested: totalInvested.toString(),
      walletBalance: walletBalance.toString(),
      totalReferrals: 0,
    };
  }

  async listUserTransactions(userId: string, params: { page: number; limit: number }) {
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: { select: { currency: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        ...t,
        amount: t.amount.toString(),
      })),
      meta: { page, limit, total },
    };
  }

  async freezeUser(userId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const prev = await tx.user.findUnique({ where: { id: userId }, select: { isFrozen: true } });
      if (!prev) throw new NotFoundException('User not found');
      await tx.user.update({
        where: { id: userId },
        data: { isFrozen: true },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'USER_FROZEN',
        entityType: 'User',
        entityId: userId,
        reason: normalizedReason,
        previousValue: { isFrozen: prev.isFrozen },
        nextValue: { isFrozen: true },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { message: 'User frozen', userId, reason: normalizedReason };
  }

  async unfreezeUser(userId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const prev = await tx.user.findUnique({ where: { id: userId }, select: { isFrozen: true } });
      if (!prev) throw new NotFoundException('User not found');
      await tx.user.update({
        where: { id: userId },
        data: { isFrozen: false },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'USER_UNFROZEN',
        entityType: 'User',
        entityId: userId,
        reason: normalizedReason,
        previousValue: { isFrozen: prev.isFrozen },
        nextValue: { isFrozen: false },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { message: 'User unfrozen', userId, reason: normalizedReason };
  }

  async suspendUser(userId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    return this.freezeUser(userId, adminId, reason, audit);
  }

  async deleteUser(userId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const prev = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isFrozen: true, email: true },
      });
      if (!prev) throw new NotFoundException('User not found');
      await tx.user.update({
        where: { id: userId },
        data: { isFrozen: true },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'USER_DISABLED',
        entityType: 'User',
        entityId: userId,
        reason: normalizedReason,
        previousValue: { isFrozen: prev.isFrozen, email: prev.email },
        nextValue: { isFrozen: true },
        metadata: { note: 'Super-admin disable (soft)' },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { message: 'User account disabled', userId, reason: normalizedReason };
  }

  async listVerifications(params: { page: number; limit: number }) {
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const [rows, total] = await Promise.all([
      this.prisma.kycVerification.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.kycVerification.count(),
    ]);
    const items = rows.map((v) => ({
      ...this.kycService.sanitizeKycRecordForResponse(v),
      user: v.user,
    }));
    return { items, meta: { page, limit, total } };
  }

  async approveVerification(
    verificationId: string,
    adminId: string,
    audit?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    await this.kycService.approveKycByVerificationId(
      adminId,
      verificationId,
      { failureReason: 'Approved by admin review' },
      audit,
    );
    await this.writeAdminActivityLog(this.dbTx(), {
      adminId,
      action: 'KYC_APPROVED',
      entityType: 'KycVerification',
      entityId: verificationId,
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });
    return { message: 'Verification approved' };
  }

  async rejectVerification(
    verificationId: string,
    adminId: string,
    dto: KycReviewDto,
    audit?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const reason = this.ensureReason(dto.failureReason);
    await this.kycService.rejectKycByVerificationId(adminId, verificationId, dto, audit);
    await this.writeAdminActivityLog(this.dbTx(), {
      adminId,
      action: 'KYC_REJECTED',
      entityType: 'KycVerification',
      entityId: verificationId,
      reason,
      ipAddress: audit?.ipAddress ?? null,
      userAgent: audit?.userAgent ?? null,
    });
    return { message: 'Verification rejected' };
  }

  async getKycDocumentSignedReadUrl(
    adminId: string,
    userId: string,
    slot: 'ID_FRONT' | 'ID_BACK' | 'SELFIE',
    audit?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    return this.kycService.getAdminKycDocumentSignedReadUrl(adminId, userId, slot, audit);
  }

  async adminRetryVirtualAccountProvisioning(userId: string, adminId: string, reason: string) {
    const normalizedReason = this.ensureReason(reason);
    const out = await this.virtualAccountService.adminRetryProvisioningForUser(userId);
    await this.writeAdminActivityLog(this.dbTx(), {
      adminId,
      action: 'RETRY_VIRTUAL_ACCOUNT_PROVISIONING',
      entityType: 'User',
      entityId: userId,
      reason: normalizedReason,
    });
    return out;
  }

  async adminListFailedVirtualAccounts(limit = 50) {
    return this.virtualAccountService.listFailedProvisioning(limit);
  }

  async adminListUnmatchedVirtualAccountDeposits(limit = 100) {
    return this.virtualAccountService.listUnmatchedDeposits(limit);
  }

  async listWalletTransactions(params: { page: number; limit: number }) {
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.transaction.count(),
    ]);
    return {
      items: items.map((t) => ({ ...t, amount: t.amount.toString() })),
      meta: { page, limit, total },
    };
  }

  private toUiRole(role: AdminRole): AdminUiRole {
    if (role === AdminRole.SUPER_ADMIN) return 'SUPER_ADMIN';
    if (role === AdminRole.APPROVER) return 'FINANCE_ADMIN';
    if (role === AdminRole.COMPLIANCE_ADMIN) return 'COMPLIANCE_ADMIN';
    return 'OPERATION_ADMIN';
  }

  private toDbRole(role: AdminUiRole): AdminRole {
    if (role === 'SUPER_ADMIN') return AdminRole.SUPER_ADMIN;
    if (role === 'FINANCE_ADMIN') return AdminRole.APPROVER;
    if (role === 'COMPLIANCE_ADMIN') return AdminRole.COMPLIANCE_ADMIN;
    return AdminRole.DATA_UPLOADER;
  }

  private displayAdminId(id: string): string {
    return `#${id.slice(0, 6).toUpperCase()}`;
  }

  private toUiStatus(accountStatus: AdminAccountStatus): AdminUiStatus {
    if (accountStatus === AdminAccountStatus.INACTIVE) return 'INACTIVE';
    if (accountStatus === AdminAccountStatus.SUSPENDED) return 'SUSPENDED';
    return 'ACTIVE';
  }

  private normalizeAdminName(email: string): string {
    const local = email.split('@')[0] ?? '';
    const cleaned = local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return 'Admin User';
    return cleaned
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  async listAdmins(params: {
    page: number;
    limit: number;
    role?: AdminUiRole;
    status?: AdminUiStatus;
    period?: 'today' | '7d' | '30d' | '180d';
    search?: string;
  }) {
    const { role, status, period, search } = params;
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const andParts: Prisma.AdminWhereInput[] = [];
    if (role) {
      andParts.push({ role: this.toDbRole(role) });
    }
    if (status) {
      andParts.push({ accountStatus: status as AdminAccountStatus });
    }
    if (search?.trim()) {
      const q = search.trim();
      andParts.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (period) {
      const now = new Date();
      let from: Date;
      switch (period) {
        case 'today':
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7d':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      }
      /** Last login in window, or never logged in but account created in window. */
      andParts.push({
        OR: [
          { lastLoginAt: { gte: from } },
          { AND: [{ lastLoginAt: null }, { createdAt: { gte: from } }] },
        ],
      });
    }
    const where: Prisma.AdminWhereInput = andParts.length ? { AND: andParts } : {};

    const [items, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          accountStatus: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.admin.count({ where }),
    ]);

    const mapped = items.map((i) => ({
      id: i.id,
      adminId: this.displayAdminId(i.id),
      fullName: i.fullName?.trim() || this.normalizeAdminName(i.email),
      email: i.email,
      role: this.toUiRole(i.role),
      status: this.toUiStatus(i.accountStatus),
      lastLoggedInAt: i.lastLoginAt,
      phoneNumber: i.phoneNumber,
      createdAt: i.createdAt,
    }));

    return { items: mapped, meta: { page, limit, total } };
  }

  async getAdminDetail(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        accountStatus: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return {
      id: admin.id,
      adminId: this.displayAdminId(admin.id),
      fullName: admin.fullName?.trim() || this.normalizeAdminName(admin.email),
      email: admin.email,
      role: this.toUiRole(admin.role),
      status: this.toUiStatus(admin.accountStatus),
      lastLoggedInAt: admin.lastLoginAt,
      phoneNumber: admin.phoneNumber,
      createdAt: admin.createdAt,
    };
  }

  async createAdmin(
    actorId: string,
    dto: { fullName?: string; email: string; phoneNumber?: string | null; role: AdminUiRole; reason: string },
    audit?: AdminRequestAudit,
  ) {
    const normalizedReason = this.ensureReason(dto.reason);
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.admin.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Admin with this email already exists');
    const tempPassword = `Admin-${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.admin.create({
        data: {
          email,
          passwordHash,
          role: this.toDbRole(dto.role),
          fullName: dto.fullName?.trim() || null,
          phoneNumber: dto.phoneNumber?.trim() || null,
          accountStatus: AdminAccountStatus.ACTIVE,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          accountStatus: true,
        },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId: actorId,
        action: 'ADMIN_CREATED',
        entityType: 'ADMIN',
        entityId: row.id,
        reason: normalizedReason,
        nextValue: {
          email: row.email,
          role: this.toUiRole(row.role),
          accountStatus: this.toUiStatus(row.accountStatus),
        },
        metadata: { createdAdminId: row.id },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
      return row;
    });

    return {
      id: created.id,
      adminId: this.displayAdminId(created.id),
      fullName: created.fullName?.trim() || this.normalizeAdminName(created.email),
      email: created.email,
      role: this.toUiRole(created.role),
      status: this.toUiStatus(created.accountStatus),
      lastLoggedInAt: created.lastLoginAt,
      phoneNumber: created.phoneNumber,
      createdAt: created.createdAt,
      tempPassword,
    };
  }

  async updateAdmin(
    actorId: string,
    id: string,
    dto: { fullName?: string; email?: string; phoneNumber?: string | null; role?: AdminUiRole; reason: string },
    audit?: AdminRequestAudit,
  ) {
    const normalizedReason = this.ensureReason(dto.reason);
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Admin not found');
      const nextEmail = dto.email?.trim().toLowerCase();
      if (nextEmail && nextEmail !== existing.email) {
        const duplicate = await tx.admin.findUnique({ where: { email: nextEmail } });
        if (duplicate) throw new ConflictException('Admin with this email already exists');
      }
      const nextDbRole = dto.role ? this.toDbRole(dto.role) : undefined;
      if (nextDbRole !== undefined && nextDbRole !== existing.role) {
        if (existing.role === AdminRole.SUPER_ADMIN && nextDbRole !== AdminRole.SUPER_ADMIN) {
          await this.assertRetainsSuperAdminCoverage(tx, id);
        }
      }
      const previousValue = {
        email: existing.email,
        role: this.toUiRole(existing.role),
        accountStatus: this.toUiStatus(existing.accountStatus),
        fullName: existing.fullName,
      };
      const row = await tx.admin.update({
        where: { id },
        data: {
          email: nextEmail ?? undefined,
          role: nextDbRole,
          fullName: dto.fullName !== undefined ? dto.fullName.trim() || null : undefined,
          phoneNumber: dto.phoneNumber !== undefined ? dto.phoneNumber?.trim() || null : undefined,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          accountStatus: true,
        },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId: actorId,
        action: 'ADMIN_UPDATED',
        entityType: 'ADMIN',
        entityId: id,
        reason: normalizedReason,
        previousValue,
        nextValue: {
          email: row.email,
          role: this.toUiRole(row.role),
          accountStatus: this.toUiStatus(row.accountStatus),
          fullName: row.fullName,
        },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
      return row;
    });

    return {
      id: updated.id,
      adminId: this.displayAdminId(updated.id),
      fullName: updated.fullName?.trim() || this.normalizeAdminName(updated.email),
      email: updated.email,
      role: this.toUiRole(updated.role),
      status: this.toUiStatus(updated.accountStatus),
      lastLoggedInAt: updated.lastLoginAt,
      phoneNumber: updated.phoneNumber,
      createdAt: updated.createdAt,
    };
  }

  async suspendAdmin(id: string, actorId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUniqueOrThrow({ where: { id } });
      await this.assertRetainsSuperAdminCoverage(tx, id);
      await tx.admin.update({
        where: { id },
        data: { accountStatus: AdminAccountStatus.SUSPENDED },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId: actorId,
        action: 'ADMIN_SUSPENDED',
        entityType: 'ADMIN',
        entityId: id,
        reason: normalizedReason,
        previousValue: { accountStatus: this.toUiStatus(existing.accountStatus), role: this.toUiRole(existing.role) },
        nextValue: { accountStatus: 'SUSPENDED' as AdminUiStatus },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { id, status: 'SUSPENDED' as AdminUiStatus };
  }

  async deactivateAdmin(id: string, actorId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUniqueOrThrow({ where: { id } });
      await this.assertRetainsSuperAdminCoverage(tx, id);
      await tx.admin.update({
        where: { id },
        data: { accountStatus: AdminAccountStatus.INACTIVE },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId: actorId,
        action: 'ADMIN_DEACTIVATED',
        entityType: 'ADMIN',
        entityId: id,
        reason: normalizedReason,
        previousValue: { accountStatus: this.toUiStatus(existing.accountStatus), role: this.toUiRole(existing.role) },
        nextValue: { accountStatus: 'INACTIVE' as AdminUiStatus },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { id, status: 'INACTIVE' as AdminUiStatus };
  }

  async getActivityLog(page = 1, limit = 50) {
    const normalized = this.normalizePagination(page, limit, 50);
    const skip = normalized.skip;
    const [items, total] = await Promise.all([
      this.prisma.adminActivityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminActivityLog.count(),
    ]);

    return {
      items,
      meta: {
        page: normalized.page,
        limit: normalized.limit,
        total,
      },
    };
  }

  async listDisputes(params: { page: number; limit: number }) {
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const where: Prisma.SupportConversationWhereInput = { isDispute: true };
    const [items, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedAdmin: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listProperties(params: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    period?: string;
  }) {
    const { status, type, period } = params;
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);

    const where: any = { deletedAt: null };

    if (status) {
      if (!Object.values(PropertyStatus).includes(status as PropertyStatus)) {
        throw new BadRequestException('Invalid property status filter');
      }
      where.status = status;
    }

    if (type) {
      where.description = { contains: type, mode: 'insensitive' };
    }

    if (period) {
      const now = new Date();
      let from: Date;
      switch (period) {
        case 'today':
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7d':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '180d':
          from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        default:
          from = new Date(0);
      }
      where.createdAt = { gte: from };
    }

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          status: true,
          totalValue: true,
          sharePrice: true,
          currency: true,
          minInvestment: true,
          currentRaised: true,
          sharesTotal: true,
          sharesSold: true,
          createdAt: true,
          _count: { select: { investments: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        totalValue: p.totalValue.toString(),
        sharePrice: p.sharePrice.toString(),
        minInvestment: p.minInvestment.toString(),
        currentRaised: p.currentRaised.toString(),
        sharesTotal: p.sharesTotal.toString(),
        sharesSold: p.sharesSold.toString(),
        investorCount: p._count.investments,
        _count: undefined,
      })),
      meta: { page, limit, total },
    };
  }

  async getPropertyDetail(propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      include: {
        documents: true,
        images: { orderBy: { position: 'asc' } },
        investments: {
          select: { userId: true, amount: true },
        },
      },
    });

    if (!property) throw new NotFoundException('Property not found');

    const totalInvestors = new Set(
      property.investments.map((i) => i.userId),
    ).size;

    const totalInvested = property.investments.reduce(
      (acc, inv) => acc.plus(toDecimal(inv.amount.toString())),
      toDecimal(0),
    );

    const totalVal = toDecimal(property.totalValue.toString());
    const yieldPercentage = totalVal.gt(0)
      ? totalInvested.div(totalVal).times(100).toFixed(2)
      : '0.00';

    const { investments: _inv, ...rest } = property;

    const images = await Promise.all(
      (property.images ?? []).map(async (img) => {
        const key = img.storageKey ?? null;
        const signedUrl = key ? await this.storage.createSignedReadUrl(key, 300).catch(() => null) : null;
        return {
          id: img.id,
          url: signedUrl ?? img.url ?? null,
          altText: img.altText ?? null,
          position: img.position,
          createdAt: img.createdAt,
        };
      }),
    );

    const documents = await Promise.all(
      (property.documents ?? []).map(async (doc) => {
        const signedUrl = doc.s3Key ? await this.storage.createSignedReadUrl(doc.s3Key, 300).catch(() => null) : null;
        return {
          id: doc.id,
          type: doc.type,
          url: signedUrl,
          createdAt: doc.createdAt,
        };
      }),
    );

    return {
      ...rest,
      totalValue: property.totalValue.toString(),
      sharePrice: property.sharePrice.toString(),
      minInvestment: property.minInvestment.toString(),
      currentRaised: property.currentRaised.toString(),
      sharesTotal: property.sharesTotal.toString(),
      sharesSold: property.sharesSold.toString(),
      totalInvestors,
      yieldPercentage,
      images,
      documents,
    };
  }

  async listPropertyInvestors(
    propertyId: string,
    params: { page: number; limit: number },
  ) {
    const { page, limit, skip } = this.normalizePagination(params.page, params.limit);
    const where = { propertyId };

    const [items, total] = await Promise.all([
      this.prisma.investment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.investment.count({ where }),
    ]);

    return {
      items: items.map((inv) => ({
        id: inv.id,
        userName:
          [inv.user.firstName, inv.user.lastName].filter(Boolean).join(' ') ||
          inv.user.email,
        email: inv.user.email,
        amountInvested: inv.amount.toString(),
        shares: inv.shares.toString(),
        sharePrice: inv.sharePrice.toString(),
        ownershipPercent: inv.ownershipPercent.toString(),
        dateInvested: inv.createdAt,
      })),
      meta: { page, limit, total },
    };
  }

  async closeProperty(propertyId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const prop = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null } });
      if (!prop) throw new NotFoundException('Property not found');
      await tx.property.update({
        where: { id: propertyId },
        data: { status: PropertyStatus.CLOSED },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'CLOSE_PROPERTY',
        entityType: 'Property',
        entityId: propertyId,
        reason: normalizedReason,
        previousValue: { status: prop.status },
        nextValue: { status: PropertyStatus.CLOSED },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });

    return { message: 'Property closed' };
  }

  async publishProperty(propertyId: string, adminId: string, audit?: AdminRequestAudit) {
    await this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findFirst({
        where: { id: propertyId, deletedAt: null },
        include: {
          _count: { select: { images: true, documents: true } },
        },
      });
      if (!property) throw new NotFoundException('Property not found');
      if (property.status !== PropertyStatus.DRAFT) {
        throw new BadRequestException('Only listings in DRAFT can be published. Unpublish or correct status first.');
      }
      const title = property.title?.trim() ?? '';
      const desc = property.description?.trim() ?? '';
      if (title.length < 2) {
        throw new BadRequestException('Property title is too short to publish.');
      }
      if (desc.length < 20) {
        throw new BadRequestException('Property description must be at least 20 characters to publish.');
      }
      const location = property.location?.trim() ?? '';
      if (location.length < 2) {
        throw new BadRequestException('Property location is too short to publish.');
      }
      if (property.annualYield == null) {
        throw new BadRequestException('Property cannot be published without annualYield disclosure.');
      }
      if (toDecimal(property.annualYield.toString()).lte(0)) {
        throw new BadRequestException('annualYield must be a positive disclosed rate.');
      }
      if (
        toDecimal(property.minInvestment.toString()).lte(0) ||
        toDecimal(property.sharePrice.toString()).lte(0) ||
        toDecimal(property.totalValue.toString()).lte(0)
      ) {
        throw new BadRequestException('minInvestment, sharePrice, and totalValue must be positive before publish.');
      }
      const mediaCount = property._count.images + property._count.documents;
      if (mediaCount < 1) {
        throw new BadRequestException('At least one image or document is required before publishing.');
      }
      if (toDecimal(property.sharesTotal.toString()).lte(0)) {
        throw new BadRequestException('sharesTotal must be positive before publish.');
      }
      if (toDecimal(property.sharesSold.toString()).lt(0)) {
        throw new BadRequestException('sharesSold cannot be negative.');
      }
      if (toDecimal(property.sharesSold.toString()).gt(toDecimal(property.sharesTotal.toString()))) {
        throw new BadRequestException('Property inventory inconsistency: sharesSold exceeds sharesTotal.');
      }
      if (toDecimal(property.currentRaised.toString()).gt(toDecimal(property.totalValue.toString()))) {
        throw new BadRequestException('currentRaised exceeds totalValue — unsafe listing state.');
      }
      await tx.property.update({
        where: { id: propertyId },
        data: { status: PropertyStatus.PUBLISHED },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'PROPERTY_PUBLISH',
        entityType: 'Property',
        entityId: propertyId,
        previousValue: { status: property.status },
        nextValue: { status: PropertyStatus.PUBLISHED },
        metadata: {
          publishGate: {
            annualYieldSet: true,
            titleLength: title.length,
            descriptionLength: desc.length,
            locationLength: location.length,
            mediaCountAtPublish: mediaCount,
            inventorySharesOk: true,
            raisedVsTotalOk: true,
            currency: String(property.currency),
          },
        },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { id: propertyId, status: PropertyStatus.PUBLISHED };
  }

  async unpublishProperty(propertyId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    await this.prisma.$transaction(async (tx) => {
      const prop = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null } });
      if (!prop) throw new NotFoundException('Property not found');
      await tx.property.update({
        where: { id: propertyId },
        data: { status: PropertyStatus.DRAFT },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'PROPERTY_UNPUBLISH',
        entityType: 'Property',
        entityId: propertyId,
        reason: normalizedReason,
        previousValue: { status: prop.status },
        nextValue: { status: PropertyStatus.DRAFT },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return { id: propertyId, status: PropertyStatus.DRAFT, reason: normalizedReason };
  }

  async softDeleteProperty(propertyId: string, adminId: string, reason: string, audit?: AdminRequestAudit) {
    const normalizedReason = this.ensureReason(reason);
    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const prop = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null } });
      if (!prop) throw new NotFoundException('Property not found');
      await tx.property.update({
        where: { id: propertyId },
        data: { deletedAt },
      });
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'DELETE_PROPERTY',
        entityType: 'Property',
        entityId: propertyId,
        reason: normalizedReason,
        previousValue: { deletedAt: null, status: prop.status },
        nextValue: { deletedAt: deletedAt.toISOString(), status: prop.status },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });

    return { message: 'Property deleted' };
  }

  async presignPropertyImage(
    propertyId: string,
    body: { fileName: string; contentType: string; fileSize: number; position?: number },
  ) {
    const prop = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true },
    });
    if (!prop) throw new NotFoundException('Property not found');

    assertValidUpload({
      category: 'propertyImage',
      contentType: body.contentType,
      fileSize: body.fileSize,
      fileName: body.fileName,
    });
    const ext = extensionFromFileName(body.fileName) || 'jpg';
    const key = this.storage.generatePropertyImageKey(propertyId, ext);
    const uploadUrl = await this.storage.createPresignedUploadUrl(key, body.contentType, 900);
    return { key, uploadUrl, expiresIn: 900 };
  }

  async completePropertyImage(
    propertyId: string,
    body: { key: string; altText?: string; position?: number },
  ) {
    if (!body.key.startsWith(`properties/${propertyId}/images/`)) {
      throw new BadRequestException('Invalid upload key');
    }
    const prop = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true },
    });
    if (!prop) throw new NotFoundException('Property not found');

    const pos =
      typeof body.position === 'number'
        ? body.position
        : (await this.prisma.propertyImage.count({ where: { propertyId } })) + 1;

    const created = await this.prisma.propertyImage.create({
      data: {
        propertyId,
        storageKey: body.key,
        altText: body.altText?.trim() || null,
        position: pos,
      },
      select: { id: true, storageKey: true, altText: true, position: true, createdAt: true, url: true },
    });

    return {
      ...created,
      url: created.storageKey
        ? await this.storage.createSignedReadUrl(created.storageKey, 300).catch(() => null)
        : null,
    };
  }

  async presignPropertyDocument(
    propertyId: string,
    body: { type: string; fileName: string; contentType: string; fileSize: number },
  ) {
    const prop = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true },
    });
    if (!prop) throw new NotFoundException('Property not found');

    assertValidUpload({
      category: 'propertyDocument',
      contentType: body.contentType,
      fileSize: body.fileSize,
      fileName: body.fileName,
    });
    const ext =
      extensionFromFileName(body.fileName) || (body.contentType === 'application/pdf' ? 'pdf' : 'jpg');
    const key = this.storage.generatePropertyDocumentKey(propertyId, ext);
    const uploadUrl = await this.storage.createPresignedUploadUrl(key, body.contentType, 900);
    return { key, uploadUrl, expiresIn: 900 };
  }

  async completePropertyDocument(propertyId: string, body: { type: string; key: string }) {
    if (!body.key.startsWith(`properties/${propertyId}/documents/`)) {
      throw new BadRequestException('Invalid upload key');
    }
    const prop = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true },
    });
    if (!prop) throw new NotFoundException('Property not found');

    const created = await this.prisma.propertyDocument.create({
      data: {
        propertyId,
        type: body.type,
        s3Key: body.key,
      },
      select: { id: true, type: true, s3Key: true, createdAt: true },
    });
    return {
      ...created,
      url: created.s3Key ? await this.storage.createSignedReadUrl(created.s3Key, 300).catch(() => null) : null,
    };
  }

  async adminListWithdrawals(params: {
    page: number;
    limit: number;
    status?: WithdrawalStatus;
    stuckOnly?: boolean;
    olderThanMinutes?: number;
  }) {
    return this.withdrawalService.adminListWithdrawals(params);
  }

  async adminReconcileWithdrawal(
    withdrawalId: string,
    adminId: string,
    reason: string,
    audit?: AdminRequestAudit,
  ) {
    const normalizedReason = this.ensureReason(reason);
    const before = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { status: true },
    });
    if (!before) throw new NotFoundException('Withdrawal not found');
    const row = await this.withdrawalService.reconcileWithdrawalById(withdrawalId);
    await this.prisma.$transaction(async (tx) => {
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'RECONCILE_WITHDRAWAL',
        entityType: 'Withdrawal',
        entityId: withdrawalId,
        reason: normalizedReason,
        previousValue: { status: before.status },
        nextValue: { status: row.status },
        metadata: { source: 'admin-reconcile' },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return row;
  }

  async adminReconcileStaleWithdrawals(
    adminId: string,
    reason: string,
    olderThanMinutes?: number,
    audit?: AdminRequestAudit,
  ) {
    const normalizedReason = this.ensureReason(reason);
    const out = await this.withdrawalService.reconcileStaleWithdrawals(olderThanMinutes ?? 30, 50);
    await this.prisma.$transaction(async (tx) => {
      await this.writeAdminActivityLog(tx as PrismaTransaction, {
        adminId,
        action: 'RECONCILE_STALE_WITHDRAWALS',
        entityType: 'Withdrawal',
        entityId: 'batch',
        reason: normalizedReason,
        metadata: {
          scanned: out.scanned,
          olderThanMinutes: olderThanMinutes ?? 30,
          results: out.results.map((r) => ({
            id: r.id,
            ok: r.ok,
            ...(r.error ? { error: r.error } : {}),
          })),
        },
        ipAddress: audit?.ipAddress ?? null,
        userAgent: audit?.userAgent ?? null,
      });
    });
    return out;
  }

  async getLedgerReconciliationReport() {
    return this.ledgerReconciliation.buildReport();
  }

  async getFinancialOpsSummary() {
    const [withdrawalsRecon, withdrawalsFailed, failedVa, unmatchedDeposits, distributionPartial, outboxSummary, ledger] =
      await Promise.all([
        this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.RECONCILIATION_REQUIRED } }),
        this.prisma.withdrawal.count({ where: { status: WithdrawalStatus.FAILED } }),
        this.virtualAccountService.listFailedProvisioning(50),
        this.virtualAccountService.listUnmatchedDeposits(50),
        this.prisma.distributionBatch.count({ where: { status: DistributionBatchStatus.PARTIALLY_FAILED } }),
        this.prisma.outboxEvent.groupBy({ by: ['status'], _count: true }),
        this.ledgerReconciliation.buildReport(),
      ]);
    const outboxPending = outboxSummary.find((r) => r.status === 'PENDING')?._count ?? 0;
    const outboxDeadLetter = outboxSummary.find((r) => r.status === 'DEAD_LETTER')?._count ?? 0;
    return {
      withdrawals: {
        reconciliationRequired: withdrawalsRecon,
        failed: withdrawalsFailed,
      },
      virtualAccounts: {
        failedOrRetryRequired: failedVa.length,
        unmatchedDeposits: unmatchedDeposits.length,
      },
      distributions: {
        partiallyFailed: distributionPartial,
      },
      outbox: {
        pending: outboxPending,
        deadLetter: outboxDeadLetter,
      },
      ledger: {
        walletMismatchCount: ledger.walletBalanceMismatches.length,
        unbalancedOperationCount: ledger.unbalancedLedgerOperations.length,
        shortOperationCount: ledger.shortLedgerOperations.length,
        transactionsWithoutLedgerOperation: ledger.transactionsWithoutLedgerOperation,
      },
    };
  }

  /**
   * Issue 12: aggregated operational signals for launch prep — not a certification of production readiness.
   * Issue 7 (investment concurrency) is never auto-certified here.
   */
  async getLaunchReadiness() {
    const financialOps = await this.getFinancialOpsSummary();
    const [kycRequiresReview, kycFailed, supportPipeline, frozenUsers] = await Promise.all([
      this.prisma.user.count({ where: { kycStatus: KycStatus.REQUIRES_REVIEW } }),
      this.prisma.user.count({ where: { kycStatus: KycStatus.FAILED } }),
      this.prisma.supportConversation.count({
        where: {
          status: {
            in: [SupportStatus.OPEN, SupportStatus.WAITING_FOR_ADMIN, SupportStatus.LIVE],
          },
        },
      }),
      this.prisma.user.count({ where: { isFrozen: true } }),
    ]);

    type LaunchItem = { code: string; message: string; count?: number };
    const blockers: LaunchItem[] = [];
    const warnings: LaunchItem[] = [];

    if (financialOps.withdrawals.reconciliationRequired > 0) {
      blockers.push({
        code: 'WITHDRAWAL_RECONCILIATION_REQUIRED',
        message: 'One or more withdrawals need reconciliation before treating payouts as settled.',
        count: financialOps.withdrawals.reconciliationRequired,
      });
    }
    if (financialOps.outbox.deadLetter > 0) {
      blockers.push({
        code: 'OUTBOX_DEAD_LETTER',
        message: 'Outbox events are in DEAD_LETTER; operational follow-up is required.',
        count: financialOps.outbox.deadLetter,
      });
    }
    if (financialOps.ledger.walletMismatchCount > 0) {
      blockers.push({
        code: 'LEDGER_WALLET_MISMATCH',
        message: 'Wallet stored balances diverge from ledger-derived totals.',
        count: financialOps.ledger.walletMismatchCount,
      });
    }
    if (financialOps.ledger.unbalancedOperationCount > 0) {
      blockers.push({
        code: 'LEDGER_UNBALANCED_OPERATION',
        message: 'Completed ledger operations with debits not matching credits.',
        count: financialOps.ledger.unbalancedOperationCount,
      });
    }
    if (financialOps.ledger.shortOperationCount > 0) {
      blockers.push({
        code: 'LEDGER_SHORT_OPERATION',
        message: 'Ledger operations with fewer than two completed legs.',
        count: financialOps.ledger.shortOperationCount,
      });
    }
    if (financialOps.ledger.transactionsWithoutLedgerOperation > 0) {
      blockers.push({
        code: 'TRANSACTIONS_WITHOUT_LEDGER_OPERATION',
        message: 'Completed transactions missing ledgerOperationId.',
        count: financialOps.ledger.transactionsWithoutLedgerOperation,
      });
    }

    if (financialOps.withdrawals.failed > 0) {
      warnings.push({
        code: 'WITHDRAWAL_FAILED',
        message: 'Failed withdrawals present; review user comms and provider state.',
        count: financialOps.withdrawals.failed,
      });
    }
    if (financialOps.virtualAccounts.failedOrRetryRequired > 0) {
      warnings.push({
        code: 'VIRTUAL_ACCOUNT_PROVISIONING_FAILURE',
        message: 'Virtual accounts failed or need retry.',
        count: financialOps.virtualAccounts.failedOrRetryRequired,
      });
    }
    if (financialOps.virtualAccounts.unmatchedDeposits > 0) {
      warnings.push({
        code: 'UNMATCHED_VIRTUAL_ACCOUNT_DEPOSITS',
        message: 'Unmatched virtual-account deposits detected (sample capped in ops queries).',
        count: financialOps.virtualAccounts.unmatchedDeposits,
      });
    }
    if (financialOps.distributions.partiallyFailed > 0) {
      warnings.push({
        code: 'DISTRIBUTION_PARTIALLY_FAILED',
        message: 'Distribution batches in PARTIALLY_FAILED state.',
        count: financialOps.distributions.partiallyFailed,
      });
    }
    if (financialOps.outbox.pending > 0) {
      warnings.push({
        code: 'OUTBOX_PENDING_BACKLOG',
        message: 'Outbox events still pending processing.',
        count: financialOps.outbox.pending,
      });
    }
    if (kycRequiresReview > 0) {
      warnings.push({
        code: 'KYC_REQUIRES_REVIEW',
        message: 'Users awaiting manual KYC review.',
        count: kycRequiresReview,
      });
    }
    if (kycFailed > 0) {
      warnings.push({
        code: 'KYC_FAILED_USERS',
        message: 'Users in FAILED KYC state may need outreach or re-submission.',
        count: kycFailed,
      });
    }
    if (supportPipeline > 0) {
      warnings.push({
        code: 'SUPPORT_OPEN_PIPELINE',
        message: 'Support conversations in OPEN, WAITING_FOR_ADMIN, or LIVE.',
        count: supportPipeline,
      });
    }
    if (frozenUsers > 0) {
      warnings.push({
        code: 'FROZEN_USERS',
        message: 'Frozen user accounts present.',
        count: frozenUsers,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      assessmentNote:
        'Automated aggregates only. This endpoint does not certify legal compliance, security review, or full production readiness.',
      issue7InvestmentConcurrency: {
        status: 'MANUAL_CHECK_REQUIRED' as const,
        detail:
          'Investment concurrency / idempotency under load is not asserted or certified by this API (tracked separately; see Issue 7).',
      },
      blockers,
      warnings,
      counts: {
        kycRequiresReview,
        kycFailed,
        supportOpenPipeline: supportPipeline,
        frozenUsers,
      },
      financialOps,
    };
  }
}

