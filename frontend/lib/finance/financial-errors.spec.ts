import { describe, expect, it } from 'vitest';
import { mapFinancialIntegrityError } from './financial-errors';

describe('mapFinancialIntegrityError', () => {
  it('maps ledger reference conflict', () => {
    const s = mapFinancialIntegrityError(new Error('ledger_reference_conflict: ref=x'), 'fallback');
    expect(s.toLowerCase()).toContain('reference');
    expect(s).not.toBe('fallback');
  });

  it('maps concurrent ledger debit message', () => {
    const s = mapFinancialIntegrityError(
      new Error('Insufficient wallet balance for ledger debit'),
      'fallback',
    );
    expect(s.toLowerCase()).toContain('insufficient');
    expect(s.toLowerCase()).toContain('refresh');
  });

  it('maps double-entry invariant failures', () => {
    const s = mapFinancialIntegrityError(new Error('Double-entry invariant failed: DEBIT total must equal CREDIT total'), 'x');
    expect(s.toLowerCase()).toContain('balanced');
  });
});
