import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Currency,
  KycStatus,
  Prisma,
  VirtualAccountDepositStatus,
  VirtualAccountProvider,
  VirtualAccountStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VIRTUAL_ACCOUNT_PROVIDER,
  VirtualAccountProviderClient,
  VirtualAccountProvisioningResult,
} from './virtual-account-provider.interface';
import { KycPolicyService } from '../kyc/kyc-policy.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VirtualAccountService {
  private readonly logger = new Logger(VirtualAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(VIRTUAL_ACCOUNT_PROVIDER)
    private readonly providerClient: VirtualAccountProviderClient,
    private readonly kycPolicy: KycPolicyService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isVirtualAccountsEnabled(): boolean {
    const enabled = this.configService.get<string>('VIRTUAL_ACCOUNTS_ENABLED') ?? 'false';
    const providerEnabled =
      this.configService.get<string>('FLUTTERWAVE_VIRTUAL_ACCOUNT_ENABLED') ?? enabled;
    return enabled === 'true' && providerEnabled === 'true';
  }

  private provider(): VirtualAccountProvider {
    return VirtualAccountProvider.FLUTTERWAVE;
  }

  private sanitizeFailureReason(raw: string | null | undefined): string | null {
    if (!raw) return null;
    return raw.replace(/sk_[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 220);
  }

  private toClientMessage(status: VirtualAccountStatus, reason?: string | null): string {
    if (status === VirtualAccountStatus.ACTIVE) {
      return 'Bank transfer funding is available.';
    }
    if (status === VirtualAccountStatus.PENDING) {
      return 'Virtual account provisioning is in progress.';
    }
    if (status === VirtualAccountStatus.REQUIRES_RETRY) {
      return 'Virtual account provisioning failed temporarily. Please retry shortly.';
    }
    if (status === VirtualAccountStatus.FAILED) {
      return reason ?? 'Virtual account provisioning failed. Contact support.';
    }
    if (status === VirtualAccountStatus.SUSPENDED || status === VirtualAccountStatus.CLOSED) {
      return 'Virtual account is not available. Contact support.';
    }
    return 'Virtual account funding is unavailable.';
  }

  private mapForUserResponse(account: {
    id: string;
    accountNumber: string | null;
    accountName: string | null;
    bankName: string | null;
    bankCode: string | null;
    currency: Currency;
    status: VirtualAccountStatus;
    failureReason: string | null;
    updatedAt: Date;
  }) {
    return {
      id: account.id,
      status: account.status,
      currency: account.currency,
      accountNumber: account.status === VirtualAccountStatus.ACTIVE ? account.accountNumber : null,
      accountName: account.status === VirtualAccountStatus.ACTIVE ? account.accountName : null,
      bankName: account.status === VirtualAccountStatus.ACTIVE ? account.bankName : null,
      bankCode: account.status === VirtualAccountStatus.ACTIVE ? account.bankCode : null,
      message: this.toClientMessage(account.status, account.failureReason),
      updatedAt: account.updatedAt,
    };
  }

  private async upsertProvisioningState(
    userId: string,
    result: VirtualAccountProvisioningResult,
    forceRetry: boolean,
  ) {
    const now = new Date();
    const failureReason = this.sanitizeFailureReason(result.failureReason);
    const data = {
      status: result.status,
      accountNumber: result.accountNumber ?? null,
      accountName: result.accountName ?? null,
      bankName: result.bankName ?? null,
      bankCode: result.bankCode ?? null,
      providerAccountId: result.providerAccountId ?? null,
      providerReference: result.providerReference ?? null,
      failureReason,
      lastProviderResponse: result.rawProviderResponse
        ? (result.rawProviderResponse as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      lastProvisionAttemptAt: now,
      provisionedAt: result.status === VirtualAccountStatus.ACTIVE ? now : null,
      retryCount: {
        increment: forceRetry || result.status !== VirtualAccountStatus.ACTIVE ? 1 : 0,
      },
    };

    return this.prisma.virtualAccount.upsert({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
      create: {
        userId,
        provider: this.provider(),
        currency: Currency.NGN,
        status: result.status,
        accountNumber: result.accountNumber ?? null,
        accountName: result.accountName ?? null,
        bankName: result.bankName ?? null,
        bankCode: result.bankCode ?? null,
        providerAccountId: result.providerAccountId ?? null,
        providerReference: result.providerReference ?? null,
        failureReason,
        lastProviderResponse: result.rawProviderResponse
          ? (result.rawProviderResponse as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lastProvisionAttemptAt: now,
        provisionedAt: result.status === VirtualAccountStatus.ACTIVE ? now : null,
        retryCount: 1,
      },
      update: data,
    });
  }

  /**
   * Creates/refreshes the user's NGN virtual account. Idempotent by unique (user, provider, currency).
   */
  async createVirtualAccountForUser(userId: string, opts?: { forceRetry?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, isFrozen: true, kycStatus: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!this.isVirtualAccountsEnabled()) {
      throw new ServiceUnavailableException('Virtual account funding is currently disabled.');
    }
    this.kycPolicy.assertFromUserSnapshot({
      isFrozen: user.isFrozen,
      kycStatus: user.kycStatus,
    });

    const existing = await this.prisma.virtualAccount.findUnique({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
    });
    if (
      existing &&
      existing.status === VirtualAccountStatus.ACTIVE &&
      existing.accountNumber &&
      !opts?.forceRetry
    ) {
      return this.mapForUserResponse(existing);
    }

    const result = await this.providerClient.createVirtualAccount({
      userId: user.id,
      email: user.email,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined,
      currency: Currency.NGN,
      previousProviderReference: existing?.providerReference ?? undefined,
    });
    const account = await this.upsertProvisioningState(user.id, result, Boolean(opts?.forceRetry));
    if (account.status === VirtualAccountStatus.ACTIVE) {
      try {
        await this.notificationsService.notifyVirtualAccountProvisioned(
          user.id,
          account.id,
          account.accountNumber ?? null,
        );
      } catch (error) {
        this.logger.warn(`Failed virtual account active notification user=${user.id}: ${String(error)}`);
      }
    } else {
      this.logger.warn(
        `Virtual account provisioning did not activate for user=${user.id}, status=${account.status}`,
      );
      try {
        await this.notificationsService.notifyVirtualAccountProvisioningFailed(
          user.id,
          account.id,
          account.failureReason,
        );
      } catch (error) {
        this.logger.warn(`Failed virtual account failure notification user=${user.id}: ${String(error)}`);
      }
    }
    return this.mapForUserResponse(account);
  }

  async retryVirtualAccountForUser(userId: string) {
    return this.createVirtualAccountForUser(userId, { forceRetry: true });
  }

  async getVirtualAccountForUser(userId: string) {
    const account = await this.prisma.virtualAccount.findUnique({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        bankName: true,
        bankCode: true,
        currency: true,
        status: true,
        failureReason: true,
        updatedAt: true,
      },
    });
    if (!account) {
      return {
        status: this.isVirtualAccountsEnabled() ? VirtualAccountStatus.PENDING : 'UNAVAILABLE',
        message: this.isVirtualAccountsEnabled()
          ? 'Virtual account has not been provisioned yet.'
          : 'Virtual account funding is disabled.',
      };
    }
    return this.mapForUserResponse(account);
  }

  async getVirtualAccountsForUser(userId: string) {
    const account = await this.prisma.virtualAccount.findUnique({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        bankName: true,
        bankCode: true,
        currency: true,
        status: true,
        failureReason: true,
        updatedAt: true,
      },
    });
    return account ? [this.mapForUserResponse(account)] : [];
  }

  async getActiveAccountByNumber(accountNumber: string) {
    return this.prisma.virtualAccount.findFirst({
      where: {
        accountNumber,
        provider: this.provider(),
        currency: Currency.NGN,
        status: VirtualAccountStatus.ACTIVE,
        user: { kycStatus: KycStatus.VERIFIED, isFrozen: false },
      },
      select: {
        id: true,
        userId: true,
        accountNumber: true,
        providerReference: true,
      },
    });
  }

  async listFailedProvisioning(limit = 50) {
    return this.prisma.virtualAccount.findMany({
      where: { status: { in: [VirtualAccountStatus.FAILED, VirtualAccountStatus.REQUIRES_RETRY] } },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listUnmatchedDeposits(limit = 100) {
    return this.prisma.virtualAccountDepositEvent.findMany({
      where: { status: VirtualAccountDepositStatus.UNMATCHED },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertEnabledForProvisioning(): Promise<void> {
    if (!this.isVirtualAccountsEnabled()) {
      throw new BadRequestException('Virtual accounts are disabled by configuration.');
    }
  }

  async adminRetryProvisioningForUser(userId: string) {
    await this.assertEnabledForProvisioning();
    return this.createVirtualAccountForUser(userId, { forceRetry: true });
  }

  async getProviderStatus(userId: string) {
    const account = await this.prisma.virtualAccount.findUnique({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
    });
    if (!account || !account.providerReference) {
      throw new BadRequestException('Provider reference not available for this account');
    }
    return this.providerClient.getVirtualAccountStatus({
      providerReference: account.providerReference,
      providerAccountId: account.providerAccountId ?? undefined,
    });
  }

  async deactivateVirtualAccount(userId: string) {
    const account = await this.prisma.virtualAccount.findUnique({
      where: {
        userId_provider_currency: {
          userId,
          provider: this.provider(),
          currency: Currency.NGN,
        },
      },
    });
    if (!account) throw new NotFoundException('Virtual account not found');
    if (account.providerAccountId) {
      await this.providerClient.maybeDeactivateVirtualAccount({ providerAccountId: account.providerAccountId });
    }
    await this.prisma.virtualAccount.update({
      where: { id: account.id },
      data: { status: VirtualAccountStatus.CLOSED },
    });
    return { ok: true };
  }

  async upsertDepositEvent(params: {
    providerTransactionId?: string | null;
    providerReference?: string | null;
    accountNumber?: string | null;
    amount?: string | null;
    currency?: Currency | null;
    status: VirtualAccountDepositStatus;
    reason?: string | null;
    payload?: object | null;
    userId?: string | null;
    virtualAccountId?: string | null;
  }) {
    if (!params.providerTransactionId) {
      return this.prisma.virtualAccountDepositEvent.create({
        data: {
          provider: this.provider(),
          providerReference: params.providerReference ?? null,
          accountNumber: params.accountNumber ?? null,
          amount: params.amount ?? null,
          currency: params.currency ?? null,
          status: params.status,
          reason: this.sanitizeFailureReason(params.reason),
          payload: params.payload ? (params.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
          userId: params.userId ?? null,
          virtualAccountId: params.virtualAccountId ?? null,
          lastVerifiedAt: new Date(),
        },
      });
    }
    return this.prisma.virtualAccountDepositEvent.upsert({
      where: { providerTransactionId: params.providerTransactionId },
      create: {
        provider: this.provider(),
        providerTransactionId: params.providerTransactionId,
        providerReference: params.providerReference ?? null,
        accountNumber: params.accountNumber ?? null,
        amount: params.amount ?? null,
        currency: params.currency ?? null,
        status: params.status,
        reason: this.sanitizeFailureReason(params.reason),
        payload: params.payload ? (params.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        userId: params.userId ?? null,
        virtualAccountId: params.virtualAccountId ?? null,
        lastVerifiedAt: new Date(),
      },
      update: {
        providerReference: params.providerReference ?? null,
        accountNumber: params.accountNumber ?? null,
        amount: params.amount ?? null,
        currency: params.currency ?? null,
        status: params.status,
        reason: this.sanitizeFailureReason(params.reason),
        payload: params.payload ? (params.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        userId: params.userId ?? null,
        virtualAccountId: params.virtualAccountId ?? null,
        lastVerifiedAt: new Date(),
      },
    });
  }
}
