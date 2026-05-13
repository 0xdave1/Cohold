/**
 * User-facing copy for virtual account status inside the wallet card (no raw enum dumps).
 */
export function getVirtualAccountWalletNotice(va: { status: string }): string | null {
  const s = (va.status ?? '').toUpperCase();
  if (s === 'FAILED' || s === 'REQUIRES_RETRY') {
    return 'Your funding account needs attention. Open Wallet to retry or get help.';
  }
  if (s === 'SUSPENDED' || s === 'CLOSED') {
    return 'Funding account is unavailable. Visit Wallet for options.';
  }
  if (s === 'PENDING') {
    return 'Your funding account is being set up.';
  }
  return null;
}
