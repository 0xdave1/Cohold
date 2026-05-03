/**
 * Mirrors backend `WithdrawalStatus` (Prisma). Keep in sync with API.
 */
export const WITHDRAWAL_STATUSES = [
  'PENDING',
  'INITIATING',
  'PROCESSING',
  'RECONCILIATION_REQUIRED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export function parseWithdrawalStatus(raw: string): WithdrawalStatus | 'UNKNOWN' {
  if ((WITHDRAWAL_STATUSES as readonly string[]).includes(raw)) {
    return raw as WithdrawalStatus;
  }
  return 'UNKNOWN';
}

export function isWithdrawalNonTerminal(status: WithdrawalStatus | 'UNKNOWN'): boolean {
  if (status === 'UNKNOWN') return true;
  return (
    status === 'PENDING' ||
    status === 'INITIATING' ||
    status === 'PROCESSING' ||
    status === 'RECONCILIATION_REQUIRED'
  );
}

export function withdrawalStatusBadgeLabel(status: WithdrawalStatus | 'UNKNOWN'): string {
  switch (status) {
    case 'PENDING':
      return 'Request received';
    case 'INITIATING':
      return 'Sending payout';
    case 'PROCESSING':
      return 'Provider processing';
    case 'RECONCILIATION_REQUIRED':
      return 'Review / confirmation';
    case 'COMPLETED':
      return 'Completed';
    case 'FAILED':
      return 'Failed (final)';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Status updating';
  }
}

export function withdrawalHeadline(status: WithdrawalStatus | 'UNKNOWN'): string {
  switch (status) {
    case 'PENDING':
      return 'Withdrawal request received';
    case 'INITIATING':
      return 'Preparing bank payout';
    case 'PROCESSING':
      return 'Payout in progress';
    case 'RECONCILIATION_REQUIRED':
      return 'Confirmation in progress';
    case 'COMPLETED':
      return 'Withdrawal completed';
    case 'FAILED':
      return 'Withdrawal could not be completed';
    case 'CANCELLED':
      return 'Withdrawal cancelled';
    default:
      return 'Withdrawal status';
  }
}

export function withdrawalSubtitle(status: WithdrawalStatus | 'UNKNOWN'): string {
  switch (status) {
    case 'PENDING':
      return 'Your request is queued. Funds stay reserved until the payout is sent to your bank or the request fails.';
    case 'INITIATING':
      return 'We are securely submitting your payout to the bank network. This usually takes a few moments.';
    case 'PROCESSING':
      return 'The provider is processing your transfer. Money is not confirmed as sent to your bank until this shows completed.';
    case 'RECONCILIATION_REQUIRED':
      return 'We could not get an immediate final answer from the provider. Your funds are not treated as lost; support may follow up. Do not assume a refund until the status updates.';
    case 'COMPLETED':
      return '';
    case 'FAILED':
      return 'The provider reported a final failure, or reconciliation confirmed failure. If a refund was applied, your wallet balance will reflect it after refresh.';
    case 'CANCELLED':
      return 'This withdrawal was cancelled before completion.';
    default:
      return 'Refresh this page in a moment for the latest status from our servers.';
  }
}

/** UI tone for icon strip — not financial outcome. */
export type WithdrawalTone = 'pending' | 'success' | 'failure' | 'neutral';

export function withdrawalTone(status: WithdrawalStatus | 'UNKNOWN'): WithdrawalTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'failure';
  if (status === 'CANCELLED') return 'neutral';
  return 'pending';
}

/** Admin ops table: late provider success vs reversal is a finance control, not a normal terminal state. */
export const ADMIN_RECONCILIATION_CONFLICT_BADGE_CLASS =
  'bg-rose-100 text-rose-900 ring-1 ring-rose-400';

export function adminWithdrawalListBadge(row: {
  status: string;
  reconciliationConflict?: boolean | null;
}): { label: string; badgeClass: string | null } {
  if (row.reconciliationConflict) {
    return {
      label: 'Ops / finance reconciliation conflict',
      badgeClass: ADMIN_RECONCILIATION_CONFLICT_BADGE_CLASS,
    };
  }
  const parsed = parseWithdrawalStatus(row.status);
  return {
    label: withdrawalStatusBadgeLabel(parsed),
    badgeClass: null,
  };
}
