import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/errors';

/** Maps API/network errors to withdrawal-specific copy (no optimistic success/failure). */
export function mapWithdrawalSubmitError(error: unknown): string {
  const code = getApiErrorCode(error);
  const msg = getApiErrorMessage(error, '');
  const lower = msg.toLowerCase();
  if (code === 'KYC_REQUIRED' || lower.includes('kyc')) {
    return 'Verified identity (KYC) is required before you can withdraw.';
  }
  if (lower.includes('frozen') || lower.includes('disabled') || lower.includes('account is disabled')) {
    return 'Your account cannot withdraw right now. Contact support if this is unexpected.';
  }
  if (lower.includes('insufficient wallet balance for ledger debit')) {
    return 'Insufficient balance: funds may have been used by another action. Refresh and try again.';
  }
  if (lower.includes('insufficient')) {
    return 'Insufficient wallet balance for this amount.';
  }
  if (lower.includes('ledger_reference_conflict') || lower.includes('duplicate client reference')) {
    return 'Duplicate request: this withdrawal or idempotency key was already processed. Refresh to see the latest status.';
  }
  if (lower.includes('linked bank') || lower.includes('bank must be')) {
    return 'Choose a verified bank account or complete bank verification first.';
  }
  if ((lower.includes('invalid') && lower.includes('otp')) || lower.includes('invalid or expired otp')) {
    return 'Invalid or expired OTP. Go back and tap Withdraw again to receive a fresh code.';
  }
  if (lower.includes('amount must') || lower.includes('decimal')) {
    return 'Enter a valid amount (up to 4 decimal places).';
  }
  return getApiErrorMessage(error, 'Withdrawal could not be completed.');
}
