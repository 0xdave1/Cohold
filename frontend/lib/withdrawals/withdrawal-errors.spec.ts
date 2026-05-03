import { describe, expect, it } from 'vitest';
import { mapWithdrawalSubmitError } from './withdrawal-errors';

describe('mapWithdrawalSubmitError', () => {
  it('maps insufficient balance message', () => {
    expect(mapWithdrawalSubmitError(new Error('Insufficient balance'))).toContain('Insufficient');
  });

  it('maps KYC via message substring', () => {
    expect(mapWithdrawalSubmitError(new Error('Verified KYC is required to withdraw'))).toContain('KYC');
  });

  it('maps concurrent ledger debit insufficient message', () => {
    const s = mapWithdrawalSubmitError(new Error('Insufficient wallet balance for ledger debit'));
    expect(s.toLowerCase()).toContain('refresh');
  });
});
