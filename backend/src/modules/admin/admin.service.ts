import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AdminAccountStatus, AdminRole, KycStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { WalletService } from '../wallet/wallet.service';
import * as bcrypt from 'bcrypt';

type AdminUiRole = 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';
type AdminUiStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

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
    const { page, limit, kycStatus } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (kycStatus) {
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
        accountNumber: u.virtualAccounts?.[0]?.accountNumber ?? null,
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
      propertiesByStatus,
      walletAggregates,
      investmentAggregates,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { kycStatus: 'VERIFIED' } }),
      this.prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      this.prisma.property.groupBy({ by: ['status'], _count: true }),
      this.prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } }),
      this.prisma.investment.groupBy({ by: ['currency'], _sum: { amount: true } }),
    ]);

    const walletBalances: Record<string, string> = {};
    for (const w of walletAggregates) {
      walletBalances[w.currency] = w._sum.balance?.toString() ?? '0';
    }

    const totalInvestments: Record<string, string> = {};
    for (const inv of investmentAggregates) {
      totalInvestments[inv.currency] = inv._sum.amount?.toString() ?? '0';
    }

    const published = propertiesByStatus.find((p) => p.status === 'PUBLISHED')?._count ?? 0;

    return {
      totalUsers: usersCount,
      totalVerifiedUsers: verifiedUsers,
      totalUnverifiedUsers: usersCount - verifiedUsers,
      totalCoholds: 0,
      totalInvestments: { NGN: '0', USD: '0', GBP: '0', EUR: '0', ...totalInvestments },
      walletBalances: { NGN: '0', USD: '0', GBP: '0', EUR: '0', ...walletBalances },
      activeListings: published,
      fractionalListings: 0,
      landListings: 0,
      ownAHomeListings: 0,
      coholdRevenue: '0',
      pendingKyc,
      openDisputes: 0,
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

    const { passwordHash: _pw, ...safeUser } = user;
    return {
      ...safeUser,
      wallets: user.wallets.map((w) => ({ ...w, balance: w.balance.toString() })),
      investments: user.investments.map((inv) => ({
        ...inv,
        amount: inv.amount.toString(),
        shares: inv.shares.toString(),
      })),
      linkedBanks: [],
      totalInvested: totalInvested.toString(),
      walletBalance: walletBalance.toString(),
      totalReferrals: 0,
    };
  }

  async listUserTransactions(userId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
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

  async suspendUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isFrozen: true },
    });
    return { message: 'User suspended' };
  }

  async deleteUser(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isFrozen: true },
    });
    return { message: 'User account disabled' };
  }

  async listVerifications(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
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
    return { items, meta: { page, limit, total } };
  }

  async approveVerification(verificationId: string, adminId: string) {
    const v = await this.prisma.kycVerification.update({
      where: { id: verificationId },
      data: { status: KycStatus.VERIFIED, reviewedById: adminId },
    });
    await this.prisma.user.update({
      where: { id: v.userId },
      data: {
        kycStatus: KycStatus.VERIFIED,
        onboardingCompletedAt: new Date(),
      },
    });

    // After KYC approval, create dedicated virtual account (Paystack).
    try {
      await this.walletService.createVirtualAccount(v.userId);
    } catch (err) {
      this.logger.warn(`Failed to create virtual account for user ${v.userId}:`, err);
    }

    return { message: 'Verification approved' };
  }

  async rejectVerification(verificationId: string, adminId: string) {
    const v = await this.prisma.kycVerification.update({
      where: { id: verificationId },
      data: { status: KycStatus.FAILED, reviewedById: adminId },
    });
    await this.prisma.user.update({
      where: { id: v.userId },
      data: { kycStatus: KycStatus.FAILED },
    });
    return { message: 'Verification rejected' };
  }

  async listWalletTransactions(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
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
    const { page, limit, role, status, period, search } = params;
    const skip = (page - 1) * limit;
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

  async createAdmin(dto: { fullName?: string; email: string; phoneNumber?: string | null; role: AdminUiRole }) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.admin.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Admin with this email already exists');
    const tempPassword = `Admin-${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const created = await this.prisma.admin.create({
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
    id: string,
    dto: { fullName?: string; email?: string; phoneNumber?: string | null; role?: AdminUiRole },
  ) {
    const existing = await this.prisma.admin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Admin not found');
    const nextEmail = dto.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== existing.email) {
      const duplicate = await this.prisma.admin.findUnique({ where: { email: nextEmail } });
      if (duplicate) throw new ConflictException('Admin with this email already exists');
    }
    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        email: nextEmail ?? undefined,
        role: dto.role ? this.toDbRole(dto.role) : undefined,
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

  async suspendAdmin(id: string, actorId: string) {
    await this.prisma.admin.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id },
        data: { accountStatus: AdminAccountStatus.SUSPENDED },
      }),
      this.prisma.adminActivityLog.create({
        data: {
          adminId: actorId,
          action: 'ADMIN_SUSPENDED',
          entityType: 'ADMIN',
          entityId: id,
        },
      }),
    ]);
    return { id, status: 'SUSPENDED' as AdminUiStatus };
  }

  async deactivateAdmin(id: string, actorId: string) {
    await this.prisma.admin.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id },
        data: { accountStatus: AdminAccountStatus.INACTIVE },
      }),
      this.prisma.adminActivityLog.create({
        data: {
          adminId: actorId,
          action: 'ADMIN_DEACTIVATED',
          entityType: 'ADMIN',
          entityId: id,
        },
      }),
    ]);
    return { id, status: 'INACTIVE' as AdminUiStatus };
  }

  async getActivityLog(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
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
        page,
        limit,
        total,
      },
    };
  }

  async listProperties(params: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
    period?: string;
  }) {
    const { page, limit, status, type, period } = params;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (status) {
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
    };
  }

  async listPropertyInvestors(
    propertyId: string,
    params: { page: number; limit: number },
  ) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
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

  async closeProperty(propertyId: string, adminId: string) {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: 'CLOSED' },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'CLOSE_PROPERTY',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    return { message: 'Property closed' };
  }

  async softDeleteProperty(propertyId: string, adminId: string) {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'DELETE_PROPERTY',
        entityType: 'Property',
        entityId: propertyId,
      },
    });

    return { message: 'Property deleted' };
  }
}

