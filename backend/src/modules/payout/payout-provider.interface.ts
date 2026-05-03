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
  status: 'PROCESSING' | 'FAILED' | 'UNKNOWN';
  rawStatus?: string | null;
  failureReason?: string | null;
  /**
   * Network/timeout/5xx or unreadable response — do not treat as final provider failure or refund.
   */
  ambiguous?: boolean;
};

/** Result of polling a transfer by provider transfer id (Flutterwave `data.id`). */
export type TransferPollResult = {
  status: 'PROCESSING' | 'FAILED' | 'SUCCESS' | 'UNKNOWN';
  providerReference: string | null;
  transferCode: string | null;
  rawStatus: string | null;
  failureReason: string | null;
  ambiguous?: boolean;
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
  /** Poll provider for final transfer state (Flutterwave: GET /transfers/:id). */
  getTransferStatus(transferId: string): Promise<TransferPollResult>;
}
