export const PAYOUT_PROVIDER = 'PAYOUT_PROVIDER';

export type ResolveBankAccountInput = {
  accountNumber: string;
  bankCode: string;
  currency: 'NGN';
};

export type ResolveBankAccountResult = {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  currency: 'NGN';
  isVerified: boolean;
};

export type SupportedBank = {
  code: string;
  name: string;
};

export type InitiateTransferInput = {
  amount: string;
  currency: 'NGN';
  reference: string;
  narration: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
};

export type InitiateTransferResult = {
  accepted: boolean;
  providerReference: string | null;
  transferCode: string | null;
  status: 'PROCESSING' | 'FAILED';
  rawStatus?: string | null;
  failureReason?: string | null;
};

export type ParsedTransferWebhook = {
  eventType: string;
  providerReference: string | null;
  transferCode: string | null;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  failureReason: string | null;
};

export interface PayoutProvider {
  resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolveBankAccountResult>;
  listSupportedBanks(currency: 'NGN'): Promise<SupportedBank[]>;
  initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult>;
  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer | string,
  ): boolean;
  parseTransferWebhook(payload: Record<string, unknown>): ParsedTransferWebhook | null;
  getTransferStatus?(providerReference: string): Promise<InitiateTransferResult>;
}
