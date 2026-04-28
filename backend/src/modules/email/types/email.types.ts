export type EmailPurpose = 'verification' | 'transaction' | 'login' | 'reset';

export type TransactionEmailKind =
  | 'deposit'
  | 'withdrawal_request'
  | 'withdrawal_success'
  | 'withdrawal_failure'
  | 'transfer_incoming'
  | 'transfer_outgoing'
  | 'investment_success'
  | 'investment_sale'
  | 'roi_payout';

export type KycEmailStatus = 'submitted' | 'approved' | 'rejected';

export interface ProviderSendInput {
  to: string;
  subject: string;
  html: string;
  fromEmail: string;
  fromName?: string;
}

export interface ProviderSendResult {
  provider: 'resend';
  providerMessageId?: string;
}
