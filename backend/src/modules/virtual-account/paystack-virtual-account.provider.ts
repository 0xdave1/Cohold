import { Injectable, Logger } from '@nestjs/common';
import { Currency, VirtualAccountStatus } from '@prisma/client';
import { PaystackProvider } from '../payment/providers/paystack.provider';
import {
  CreateVirtualAccountInput,
  VirtualAccountProviderClient,
  VirtualAccountProvisioningResult,
  VirtualAccountStatusResult,
} from './virtual-account-provider.interface';

@Injectable()
export class PaystackVirtualAccountProvider implements VirtualAccountProviderClient {
  private readonly logger = new Logger(PaystackVirtualAccountProvider.name);

  constructor(private readonly paystack: PaystackProvider) {}

  private toFailure(message: string, raw?: Record<string, unknown>): VirtualAccountProvisioningResult {
    const lower = message.toLowerCase();
    const transient = /(timeout|temporar|network|429|rate|try again|service unavailable)/.test(lower);
    return {
      status: transient ? VirtualAccountStatus.REQUIRES_RETRY : VirtualAccountStatus.FAILED,
      failureReason: message.slice(0, 220),
      rawProviderResponse: raw,
    };
  }

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountProvisioningResult> {
    if (input.currency !== Currency.NGN) {
      return {
        status: VirtualAccountStatus.FAILED,
        failureReason: 'Only NGN virtual accounts are currently supported.',
      };
    }
    try {
      const [firstName, ...rest] = (input.fullName ?? '').split(/\s+/).filter(Boolean);
      const customerCode = await this.paystack.createCustomer({
        email: input.email,
        firstName: firstName || undefined,
        lastName: rest.join(' ') || undefined,
      });
      const dva = await this.paystack.createDedicatedVirtualAccount({
        customerCode,
        preferredBank: undefined,
      });
      return {
        status: VirtualAccountStatus.ACTIVE,
        accountNumber: dva.accountNumber,
        accountName: dva.accountName,
        bankName: dva.bankName,
        bankCode: dva.bankCode ?? undefined,
        providerAccountId: dva.providerAccountId,
        providerReference: customerCode,
        rawProviderResponse: dva.raw,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Paystack virtual account provisioning failed: ${msg}`);
      return this.toFailure(msg);
    }
  }

  async getVirtualAccountStatus(input: {
    providerReference?: string;
    providerAccountId?: string;
  }): Promise<VirtualAccountStatusResult> {
    if (!input.providerAccountId && !input.providerReference) {
      return { status: VirtualAccountStatus.REQUIRES_RETRY };
    }
    try {
      if (input.providerAccountId) {
        const data = await this.paystack.fetchDedicatedVirtualAccount(input.providerAccountId);
        const active = Boolean(data.account_number ?? (data.account as Record<string, unknown> | undefined)?.account_number);
        return {
          status: active ? VirtualAccountStatus.ACTIVE : VirtualAccountStatus.PENDING,
          providerReference: input.providerReference,
          providerAccountId: input.providerAccountId,
          rawProviderResponse: data,
        };
      }
      return { status: VirtualAccountStatus.PENDING, providerReference: input.providerReference };
    } catch {
      return { status: VirtualAccountStatus.REQUIRES_RETRY };
    }
  }

  async maybeDeactivateVirtualAccount(_input: { providerAccountId: string }): Promise<void> {
    this.logger.warn('Paystack dedicated account deactivation is not implemented; account marked closed locally only.');
  }
}
