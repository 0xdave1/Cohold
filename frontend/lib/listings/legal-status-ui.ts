const PRETTY: Record<string, string> = {
  UNSPECIFIED: 'Not specified',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  APPROVED: 'Approved',
};

export function formatTitleVerificationLabel(status: string | null | undefined): string {
  const key = (status ?? 'UNSPECIFIED').toUpperCase();
  return PRETTY[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

export function formatLegalReviewLabel(status: string | null | undefined): string {
  const key = (status ?? 'UNSPECIFIED').toUpperCase();
  return PRETTY[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

export function formatYieldBasisLabel(basis: string | null | undefined): string {
  const b = (basis ?? 'UNSPECIFIED').toUpperCase();
  if (b === 'PROJECTED') return 'Projected estimate';
  if (b === 'HISTORICAL') return 'Historical (where applicable)';
  return 'Not specified';
}
