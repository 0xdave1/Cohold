export type BackendKycStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMITTED'
  | 'REVOKED'
  | 'REQUIRES_REVIEW'
  | 'MANUAL_REVIEW'
  | 'PENDING'
  | 'FAILED'
  | null
  | undefined
  | string;

export type KycStatusNormalized =
  | 'NOT_STARTED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMITTED'
  | 'REVOKED'
  | 'REQUIRES_REVIEW'
  | 'MANUAL_REVIEW'
  | 'UNKNOWN';

export function normalizeKycStatus(status: BackendKycStatus): KycStatusNormalized {
  const s = String(status ?? '').trim().toUpperCase();
  if (!s) return 'NOT_STARTED';
  if (s === 'NOT_STARTED') return 'NOT_STARTED';
  if (s === 'SUBMITTED' || s === 'PENDING_REVIEW' || s === 'PENDING') return 'PENDING_REVIEW';
  if (s === 'VERIFIED') return 'VERIFIED';
  if (s === 'REJECTED' || s === 'FAILED') return 'REJECTED';
  if (s === 'RESUBMITTED') return 'RESUBMITTED';
  if (s === 'REVOKED') return 'REVOKED';
  if (s === 'REQUIRES_REVIEW') return 'REQUIRES_REVIEW';
  if (s === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
  return 'UNKNOWN';
}

export function isKycVerified(status: BackendKycStatus): boolean {
  return normalizeKycStatus(status) === 'VERIFIED';
}

export function isKycMoneyActionAllowed(status: BackendKycStatus): boolean {
  return isKycVerified(status);
}

export function kycStatusUnderReview(status: BackendKycStatus): boolean {
  const normalized = normalizeKycStatus(status);
  return (
    normalized === 'PENDING_REVIEW' ||
    normalized === 'RESUBMITTED' ||
    normalized === 'MANUAL_REVIEW' ||
    normalized === 'REQUIRES_REVIEW'
  );
}
