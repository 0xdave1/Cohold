import { isKycMoneyActionAllowed, normalizeKycStatus, type BackendKycStatus } from '@/lib/kyc/status';

describe('KYC status normalization and gating', () => {
  const table: Array<[BackendKycStatus, string]> = [
    ['NOT_STARTED', 'NOT_STARTED'],
    ['SUBMITTED', 'PENDING_REVIEW'],
    ['PENDING_REVIEW', 'PENDING_REVIEW'],
    ['PENDING', 'PENDING_REVIEW'],
    ['VERIFIED', 'VERIFIED'],
    ['REJECTED', 'REJECTED'],
    ['FAILED', 'REJECTED'],
    ['RESUBMITTED', 'RESUBMITTED'],
    ['REVOKED', 'REVOKED'],
    ['REQUIRES_REVIEW', 'REQUIRES_REVIEW'],
    ['MANUAL_REVIEW', 'MANUAL_REVIEW'],
    ['anything-else', 'UNKNOWN'],
    [null, 'NOT_STARTED'],
  ];

  it.each(table)('normalizes %s -> %s', (input, expected) => {
    expect(normalizeKycStatus(input)).toBe(expected);
  });

  it('only VERIFIED can perform money actions', () => {
    expect(isKycMoneyActionAllowed('VERIFIED')).toBe(true);
    expect(isKycMoneyActionAllowed('MANUAL_REVIEW')).toBe(false);
    expect(isKycMoneyActionAllowed('REQUIRES_REVIEW')).toBe(false);
    expect(isKycMoneyActionAllowed('REJECTED')).toBe(false);
    expect(isKycMoneyActionAllowed('UNKNOWN')).toBe(false);
    expect(isKycMoneyActionAllowed(null)).toBe(false);
  });
});
