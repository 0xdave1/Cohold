export type DistributionUiStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PROCESSING'
  | 'POSTED'
  | 'FAILED'
  | 'SKIPPED'
  | 'REVERSED'
  | 'RECONCILIATION_REQUIRED'
  | 'UNKNOWN';

export function normalizeDistributionStatus(raw: unknown): DistributionUiStatus {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'DRAFT') return 'DRAFT';
  if (s === 'PENDING' || s === 'APPROVED') return 'PENDING';
  if (s === 'PROCESSING') return 'PROCESSING';
  if (s === 'POSTED' || s === 'COMPLETED') return 'POSTED';
  if (s === 'FAILED' || s === 'PARTIALLY_FAILED') return 'FAILED';
  if (s === 'SKIPPED') return 'SKIPPED';
  if (s === 'REVERSED') return 'REVERSED';
  if (s === 'RECONCILIATION_REQUIRED') return 'RECONCILIATION_REQUIRED';
  return 'UNKNOWN';
}

export function distributionStatusLabel(status: DistributionUiStatus): string {
  if (status === 'POSTED') return 'Paid';
  if (status === 'PENDING') return 'Pending approval';
  if (status === 'PROCESSING') return 'Processing';
  if (status === 'FAILED') return 'Failed';
  if (status === 'REVERSED') return 'Reversed';
  if (status === 'SKIPPED') return 'Skipped';
  if (status === 'RECONCILIATION_REQUIRED') return 'Reconciliation required';
  if (status === 'DRAFT') return 'Draft';
  return 'Unknown';
}
