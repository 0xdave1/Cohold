import { redirect } from 'next/navigation';

/**
 * Legacy URL from the old client-only withdrawal flow.
 * Withdrawal outcomes are shown at /dashboard/wallets/withdraw/[withdrawalId] using real API data.
 */
export default function LegacyWithdrawSuccessRedirectPage() {
  redirect('/dashboard/home');
}
