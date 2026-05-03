/**
 * Wallet `Transaction` rows from backend (Prisma `TransactionStatus`): PENDING | COMPLETED | FAILED.
 * If the API ever forwards ledger-operation-level statuses on a leg, map them explicitly; unknown → neutral.
 */

export type TransactionStatusTone = 'success' | 'pending' | 'failure' | 'neutral' | 'ops';

const KNOWN_STATUSES = [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'POSTED',
  'REVERSED',
  'VOIDED',
  'RECONCILIATION_REQUIRED',
] as const;

export function parseTransactionStatus(raw: string): string {
  if ((KNOWN_STATUSES as readonly string[]).includes(raw)) return raw;
  return 'UNKNOWN';
}

export function transactionStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending settlement';
    case 'COMPLETED':
    case 'POSTED':
      return 'Posted';
    case 'FAILED':
      return 'Failed';
    case 'RECONCILIATION_REQUIRED':
      return 'Ops review (reconciliation)';
    case 'REVERSED':
      return 'Reversed';
    case 'VOIDED':
      return 'Voided';
    case 'UNKNOWN':
      return 'Unknown status';
    default:
      return 'Status updating';
  }
}

export function transactionStatusTone(status: string): TransactionStatusTone {
  if (status === 'COMPLETED' || status === 'POSTED') return 'success';
  if (status === 'FAILED') return 'failure';
  if (status === 'RECONCILIATION_REQUIRED') return 'ops';
  if (status === 'REVERSED' || status === 'VOIDED') return 'neutral';
  if (status === 'PENDING') return 'pending';
  return 'neutral';
}
