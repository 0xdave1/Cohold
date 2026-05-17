import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { ResidentialDetailsDto } from './dto/residential-details.dto';
import { AddLinkedBankDto } from './dto/add-linked-bank.dto';
import { assertValidUsername, normalizeUsername, validateUsername } from '../../common/username/username.util';
import {
  Currency,
  InvestmentStatus,
  KycStatus,
  Prisma,
  SupportStatus,
  VirtualAccountStatus,
  WithdrawalStatus,
} from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { PAYOUT_PROVIDER, PayoutProvider } from '../payout/payout-provider.interface';
import { KycService } from '../kyc/kyc.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
    private readonly kycService: KycService,
  ) {}

  async getMe(userId: string) {
    await this.kycService.reconcileUserKycSnapshotIfDrifted(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        phoneCountryCode: true,
        nationality: true,
        houseNumber: true,
        streetName: true,
        city: true,
        state: true,
        kycStatus: true,
        onboardingCompletedAt: true,
        profilePhotoKey: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const signedProfileImageUrl = user.profilePhotoKey
      ? await this.storage.createSignedReadUrl(user.profilePhotoKey, 300).catch(() => null)
      : null;

    return {
      ...user,
      requiresUsernameSetup: user.username == null,
      profilePhotoUrl: signedProfileImageUrl ?? user.profileImageUrl ?? null,
      profileImageUrl: signedProfileImageUrl ?? user.profileImageUrl ?? null,
    };
  }

  async setProfilePhotoKey(userId: string, key: string) {
    // Verify key belongs to current user.
    if (!key.startsWith(`users/${userId}/profile/`)) {
      throw new BadRequestException('Invalid upload key');
    }
    const signedUrl = await this.storage.createSignedReadUrl(key, 300).catch(() => null);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        profilePhotoKey: key,
        profileImageUrl: signedUrl,
      },
    });
    return this.getMe(userId);
  }

  async checkUsernameAvailability(usernameInput: string) {
    const v = validateUsername(usernameInput);
    if (!v.ok) {
      return {
        available: false,
        normalizedUsername: normalizeUsername(usernameInput),
        reason: v.code,
      };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: v.normalized },
      select: { id: true },
    });

    return {
      available: !existing,
      normalizedUsername: v.normalized,
      reason: existing ? 'USERNAME_TAKEN' : null,
    };
  }

  /**
   * Strict, production-safe policy:
   * - legacy users with null username may set it once
   * - once set, username cannot be changed (until a dedicated, audited rename flow exists)
   */
  async setUsername(userId: string, usernameInput: string) {
    const normalized = assertValidUsername(usernameInput);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.username) {
      throw new BadRequestException({
        code: 'USERNAME_INVALID',
        message: 'Username is already set and cannot be changed at this time',
      });
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { username: normalized },
      });
    } catch (err) {
      // Unique constraint race
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Username is taken' });
      }
      throw err;
    }

    return this.getMe(userId);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        nationality: dto.nationality,
        houseNumber: dto.houseNumber,
        streetName: dto.streetName,
        city: dto.city,
        state: dto.state,
      },
    });
    return this.getMe(userId);
  }

  async updatePersonalDetails(userId: string, dto: PersonalDetailsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneCountryCode: dto.phoneCountryCode,
        phoneNumber: dto.phoneNumber,
        nationality: dto.nationality,
      },
    });
    return this.getMe(userId);
  }

  async updateResidentialDetails(userId: string, dto: ResidentialDetailsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        houseNumber: dto.houseNumber,
        streetName: dto.streetName,
        city: dto.city,
        state: dto.state,
      },
    });
    return this.getMe(userId);
  }

  async completeOnboarding(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return this.getMe(userId);
  }

  async freezeAccount(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isFrozen: true },
    });
    return { message: 'Account has been deactivated' };
  }

  /**
   * Referral rewards are not ledger-backed in this codebase; do not surface fake earnings.
   */
  async getReferrals(_userId: string) {
    return {
      supported: false as const,
      referralCode: null as string | null,
      referralLink: null as string | null,
      invitedUsersCount: null as number | null,
      earnedRewardsTotal: null as string | null,
      pendingRewardsTotal: null as string | null,
      unsupportedReason:
        'Referral rewards are not implemented with ledger settlement. No earnings are shown.',
    };
  }

  /** Issue 12: truthful onboarding checklist (informational; policies remain authoritative). */
  async getOnboardingChecklist(userId: string) {
    await this.kycService.reconcileUserKycSnapshotIfDrifted(userId);

    const [user, kyc, va, walletAgg, investmentCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerifiedAt: true,
          kycStatus: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          onboardingCompletedAt: true,
          profilePhotoKey: true,
        },
      }),
      this.prisma.kycVerification.findUnique({
        where: { userId },
        select: { status: true },
      }),
      this.prisma.virtualAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),
      this.prisma.wallet.aggregate({
        where: { userId },
        _sum: { balance: true },
      }),
      this.prisma.investment.count({ where: { userId, status: InvestmentStatus.ACTIVE } }),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const walletFunded =
      walletAgg._sum.balance != null && Number(walletAgg._sum.balance) > 0;

    return {
      emailVerified: user.emailVerifiedAt != null,
      kycSubmitted: kyc != null,
      kycVerified: user.kycStatus === KycStatus.VERIFIED,
      virtualAccountActive: va?.status === VirtualAccountStatus.ACTIVE,
      walletFunded,
      firstInvestmentCompleted: investmentCount > 0,
      profileBasicsComplete: Boolean(
        (user.firstName?.trim() && user.lastName?.trim()) || user.phoneNumber?.trim(),
      ),
      profilePhotoPresent: Boolean(user.profilePhotoKey?.trim()),
      onboardingFlagSetAt: user.onboardingCompletedAt?.toISOString() ?? null,
      note: 'Checklist is informational for UX; authorization still follows server-side rules.',
    };
  }

  /** Issue 12: dashboard summary — backend-derived only; unsupported metrics explicit null + reason. */
  async getDashboardSummary(userId: string) {
    await this.kycService.reconcileUserKycSnapshotIfDrifted(userId);

    const pendingWithdrawalStatuses: WithdrawalStatus[] = [
      WithdrawalStatus.PENDING,
      WithdrawalStatus.INITIATING,
      WithdrawalStatus.PROCESSING,
      WithdrawalStatus.RECONCILIATION_REQUIRED,
    ];

    const [
      wallets,
      pendingWithdrawals,
      activeInvestments,
      paidDistributionPayouts,
      userRow,
      virtualAccount,
      unreadNotifications,
      openSupportTickets,
    ] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { userId },
        select: { currency: true, balance: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { userId, status: { in: pendingWithdrawalStatuses } },
        _count: { id: true },
        _sum: { netAmount: true },
      }),
      this.prisma.investment.aggregate({
        where: { userId, status: InvestmentStatus.ACTIVE },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.distributionPayout.aggregate({
        where: { investment: { userId } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true },
      }),
      this.prisma.virtualAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, accountNumber: true, bankName: true },
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
      this.prisma.supportConversation.count({
        where: { userId, status: SupportStatus.OPEN },
      }),
    ]);

    if (!userRow) throw new NotFoundException('User not found');

    const maskVaLast4 = (raw?: string | null) => {
      if (!raw) return null;
      const digits = raw.replace(/\D/g, '');
      if (!digits) return null;
      return `****${digits.slice(-4)}`;
    };

    return {
      walletBalances: wallets.map((w) => ({
        currency: w.currency,
        balance: w.balance.toString(),
      })),
      pendingWithdrawals: {
        count: pendingWithdrawals._count.id,
        totalNetAmount: pendingWithdrawals._sum.netAmount?.toString() ?? '0.0000',
      },
      activeInvestments: {
        count: activeInvestments._count.id,
        principalInvested: activeInvestments._sum.amount?.toString() ?? '0.0000',
      },
      /** Sum of distribution payout rows credited to this user's positions (not projected yield). */
      paidDistributionsFromPayouts: {
        payoutCount: paidDistributionPayouts._count.id,
        totalAmount: paidDistributionPayouts._sum.amount?.toString() ?? '0.0000',
        note: 'Totals distribution payout lines linked to your investments; excludes unrealized or projected returns.',
      },
      projectedPortfolioYield: {
        value: null as string | null,
        unsupportedReason:
          'No portfolio-wide projected yield is computed. See each property listing for disclosed annual yield (projected, not guaranteed).',
      },
      kycStatus: userRow.kycStatus,
      virtualAccount: virtualAccount
        ? {
            status: virtualAccount.status,
            /** Masked display only; full account number is not returned. */
            accountNumberLast4: maskVaLast4(virtualAccount.accountNumber),
            bankName: virtualAccount.bankName ?? null,
          }
        : { status: 'NONE' as const, accountNumberLast4: null, bankName: null },
      unreadNotificationsCount: unreadNotifications,
      openSupportTicketsCount: openSupportTickets,
      unsupported: {
        secondaryMarketLiquidity: {
          value: null,
          unsupportedReason: 'Secondary market / resale liquidity is not offered on this platform.',
        },
      },
    };
  }

  async clearProfilePhoto(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoKey: null, profileImageUrl: null },
    });
    return this.getMe(userId);
  }

  async getLinkedBanks(userId: string) {
    const rows = await this.prisma.linkedBankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        accountNumber: true,
        bankName: true,
        accountName: true,
        currency: true,
        isDefault: true,
        bankCode: true,
        isVerified: true,
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        accountNumber: r.accountNumber,
        bankName: r.bankName,
        accountName: r.accountName,
        currency: r.currency,
        isDefault: r.isDefault,
        bankCode: r.bankCode,
        isVerified: r.isVerified,
      })),
    };
  }

  async addLinkedBank(userId: string, dto: AddLinkedBankDto) {
    if (dto.currency !== 'NGN') {
      throw new BadRequestException('Only NGN linked banks are supported');
    }

    const accountNumber = dto.accountNumber.replace(/\D/g, '');
    if (accountNumber.length < 10 || accountNumber.length > 16) {
      throw new BadRequestException('Invalid account number');
    }

    const bankCode = dto.bankCode.trim();
    const resolved = await this.payoutProvider.resolveBankAccount({
      accountNumber,
      bankCode,
      currency: 'NGN',
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.linkedBankAccount.findUnique({
          where: {
            userId_currency_accountNumber: {
              userId,
              currency: Currency.NGN,
              accountNumber,
            },
          },
        });
        if (existing) {
          throw new ConflictException({
            code: 'LINKED_BANK_DUPLICATE',
            message: 'This bank account is already linked',
          });
        }

        const count = await tx.linkedBankAccount.count({ where: { userId } });
        const makeDefault = dto.isDefault === true || count === 0;

        if (makeDefault) {
          await tx.linkedBankAccount.updateMany({
            where: { userId },
            data: { isDefault: false },
          });
        }

        return tx.linkedBankAccount.create({
          data: {
            userId,
            currency: Currency.NGN,
            accountNumber: resolved.accountNumber,
            bankName: resolved.bankName,
            accountName: resolved.accountName,
            bankCode: resolved.bankCode,
            isDefault: makeDefault,
            isVerified: resolved.isVerified,
          },
          select: {
            id: true,
            accountNumber: true,
            bankName: true,
            accountName: true,
            currency: true,
            isDefault: true,
          },
        });
      });

      return created;
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          code: 'LINKED_BANK_DUPLICATE',
          message: 'This bank account is already linked',
        });
      }
      throw e;
    }
  }

  async getSupportedBanks() {
    const items = await this.payoutProvider.listSupportedBanks('NGN');
    return { items };
  }

  async removeLinkedBank(userId: string, id: string) {
    const row = await this.prisma.linkedBankAccount.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Linked bank not found');
    }

    const withdrawalRefs = await this.prisma.withdrawal.count({
      where: { linkedBankAccountId: id },
    });
    if (withdrawalRefs > 0) {
      throw new BadRequestException({
        code: 'LINKED_BANK_IN_USE',
        message: 'Cannot remove a bank that has withdrawal history. Contact support if you need to replace it.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const wasDefault = row.isDefault;
      await tx.linkedBankAccount.delete({ where: { id } });

      if (wasDefault) {
        const next = await tx.linkedBankAccount.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (next) {
          await tx.linkedBankAccount.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return { ok: true };
  }
}

