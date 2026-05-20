/**
 * User/admin-facing payment provider labels (no Flutterwave).
 */
export function formatPaymentProviderLabel(provider: string | null | undefined): string {
  const p = (provider ?? '').trim().toUpperCase();
  if (!p) return 'Paystack';
  if (p === 'PAYSTACK') return 'Paystack';
  if (p === 'FLUTTERWAVE') return 'Legacy provider';
  return provider ?? '—';
}

/** Active production provider for new provisioning rows. */
export const ACTIVE_WALLET_FUNDING_PROVIDER = 'Paystack' as const;
