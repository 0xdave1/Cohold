import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/errors';

/**
 * Maps API errors for money movement to explicit copy (Issue 3 — no generic masking).
 */
export function mapFinancialIntegrityError(error: unknown, fallback: string): string {
  const code = getApiErrorCode(error);
  const msg = getApiErrorMessage(error, '');
  const lower = msg.toLowerCase();

  if (code === 'CONFLICT' || lower.includes('ledger_reference_conflict') || lower.includes('duplicate')) {
    return 'This payment or transfer reference already exists. If you retried, your wallet may already be updated — refresh balances. Contact support if amounts look wrong.';
  }
  if (code === 'KYC_REQUIRED' || lower.includes('kyc required') || lower.includes('kyc')) {
    return 'KYC verification is required for this money action. Complete KYC and try again.';
  }
  if (code === 'ACCOUNT_FROZEN' || lower.includes('frozen') || lower.includes('suspended')) {
    return 'Your account is currently restricted. Contact support before trying this action again.';
  }
  if (
    code === 'PROPERTY_SOLD_OUT' ||
    lower.includes('property_sold_out') ||
    lower.includes('sold out') ||
    lower.includes('insufficient available shares')
  ) {
    return 'This property is sold out or has insufficient shares available. Refresh the listing and try a lower quantity.';
  }
  if (code === 'PROPERTY_NOT_INVESTABLE' || lower.includes('not investable') || lower.includes('inactive property')) {
    return 'This listing is not currently open for investments.';
  }
  if (code === 'CHECKOUT_DISABLED' || lower.includes('direct checkout is disabled') || lower.includes('checkout disabled')) {
    return 'Direct checkout is disabled. Use wallet-funded purchase for investments.';
  }
  if (code === 'IDEMPOTENCY_CONFLICT' || lower.includes('idempotency')) {
    return 'This request conflicts with a previous submission key. Refresh and submit a new request.';
  }
  if (code === 'LEDGER_CONFLICT') {
    return 'This action conflicts with an existing ledger operation. Refresh balances and try again.';
  }
  if (code === 'INSUFFICIENT_BALANCE') {
    return 'Insufficient wallet balance for this action.';
  }
  if (lower.includes('insufficient wallet balance for ledger debit')) {
    return 'Insufficient balance: another action may have used funds first. Refresh and try a smaller amount.';
  }
  if (
    lower.includes('double-entry') ||
    (lower.includes('debit') && lower.includes('credit') && lower.includes('total'))
  ) {
    return 'The server could not post a balanced ledger entry. Nothing was taken from your wallet; contact support with the time of the request.';
  }
  if (lower.includes('conflicting') && (lower.includes('ledger') || lower.includes('reference'))) {
    return msg || 'This request conflicts with an existing money movement. Refresh your balance and history; do not retry blindly.';
  }
  if (lower.includes('insufficient')) {
    return msg || 'Insufficient wallet balance for this action.';
  }
  if (lower.includes('cannot run without approved income event') || lower.includes('income event')) {
    return 'Distribution cannot run yet because the income event is missing or not approved.';
  }
  if (lower.includes('batch cannot be processed') || lower.includes('processing')) {
    return 'This distribution batch is currently processing or not in a processable state.';
  }
  if (lower.includes('partially_failed') || lower.includes('partial')) {
    return 'Distribution processing completed with partial failures. Check failed items before retrying.';
  }
  if (lower.includes('insufficient property income wallet balance')) {
    return 'Distribution failed safely because the property income wallet balance is insufficient.';
  }
  if (lower.includes('reconciliation')) {
    return msg || 'This movement needs manual confirmation. Do not assume success or failure until status updates.';
  }
  if (lower.includes('ledger') && lower.includes('pending')) {
    return msg || 'Funds may be with the provider while the ledger is still settling. Refresh in a moment; your balance only reflects confirmed ledger rows.';
  }
  if (lower.includes('verify') && lower.includes('payment')) {
    return msg || 'Payment could not be verified yet. Your balance only updates after the server confirms funds.';
  }
  if (code === 'UNKNOWN') {
    return msg || fallback;
  }
  return getApiErrorMessage(error, fallback);
}
