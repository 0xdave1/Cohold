import { Currency, VirtualAccountStatus } from '@prisma/client';

export type CreateVirtualAccountInput = {
  userId: string;
  email: string;
  fullName?: string;
  currency: Currency;
  previousProviderReference?: string;
};

export type VirtualAccountProvisioningResult = {
  status: VirtualAccountStatus;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  providerAccountId?: string;
  providerReference?: string;
  failureReason?: string;
  rawProviderResponse?: Record<string, unknown>;
};

export type VirtualAccountStatusResult = {
  status: VirtualAccountStatus;
  providerReference?: string;
  providerAccountId?: string;
  rawProviderResponse?: Record<string, unknown>;
};

export interface VirtualAccountProviderClient {
  createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountProvisioningResult>;
  getVirtualAccountStatus(input: {
    providerReference?: string;
    providerAccountId?: string;
  }): Promise<VirtualAccountStatusResult>;
  maybeDeactivateVirtualAccount(input: { providerAccountId: string }): Promise<void>;
}

export const VIRTUAL_ACCOUNT_PROVIDER = Symbol('VIRTUAL_ACCOUNT_PROVIDER');
