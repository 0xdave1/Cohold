import { describe, expect, it } from 'vitest';
import {
  formatDedicatedAccountMask,
  resolveDedicatedAccountPillState,
} from './dedicated-account-display';

describe('formatDedicatedAccountMask', () => {
  it('masks from accountNumberLast4 backend shape', () => {
    expect(formatDedicatedAccountMask({ accountNumberLast4: '****6789' })).toBe('•••• 6789');
  });

  it('masks from full account number without returning it', () => {
    expect(formatDedicatedAccountMask({ accountNumber: '0123456789' })).toBe('•••• 6789');
    expect(formatDedicatedAccountMask({ accountNumber: '0123456789' })).not.toBe('0123456789');
  });

  it('returns null when no digits', () => {
    expect(formatDedicatedAccountMask({ accountNumberLast4: null, accountNumber: null })).toBeNull();
  });
});

describe('resolveDedicatedAccountPillState', () => {
  it('ACTIVE with mask yields active clickable pill', () => {
    const state = resolveDedicatedAccountPillState({
      kycVerified: true,
      status: 'ACTIVE',
      accountNumberLast4: '****1299',
    });
    expect(state.kind).toBe('active');
    expect(state.maskedLabel).toBe('•••• 1299');
    expect(state.clickable).toBe(true);
  });

  it('PENDING yields provisioning copy', () => {
    const state = resolveDedicatedAccountPillState({
      kycVerified: true,
      status: 'PENDING',
    });
    expect(state.kind).toBe('provisioning');
    expect(state.maskedLabel).toBeUndefined();
  });

  it('PROCESSING yields provisioning copy', () => {
    expect(
      resolveDedicatedAccountPillState({ kycVerified: true, status: 'PROCESSING' }).kind,
    ).toBe('provisioning');
  });

  it('FAILED and REQUIRES_RETRY yield retry pill', () => {
    expect(resolveDedicatedAccountPillState({ kycVerified: true, status: 'FAILED' }).kind).toBe(
      'retry',
    );
    expect(
      resolveDedicatedAccountPillState({ kycVerified: true, status: 'REQUIRES_RETRY' }).kind,
    ).toBe('retry');
  });

  it('unverified KYC does not expose account digits', () => {
    const state = resolveDedicatedAccountPillState({
      kycVerified: false,
      status: 'ACTIVE',
      accountNumber: '0123456789',
      accountNumberLast4: '****6789',
    });
    expect(state.kind).toBe('kyc_required');
    expect(state.maskedLabel).toBeUndefined();
  });

  it('UNAVAILABLE yields subtle unavailable state', () => {
    expect(resolveDedicatedAccountPillState({ kycVerified: true, status: 'UNAVAILABLE' }).kind).toBe(
      'unavailable',
    );
  });
});
