import { describe, expect, it } from 'vitest';
import type { LedgerReconciliationReport } from './ledger-reconciliation';

/** Read-only admin report shape — mismatches must be visible in UI tables. */
function summarizeReport(r: LedgerReconciliationReport) {
  return {
    mismatchCount: r.walletBalanceMismatches.length,
    legacyLegs: r.transactionsWithoutLedgerOperation,
    unbalanced: r.unbalancedLedgerOperations.length,
    short: r.shortLedgerOperations.length,
  };
}

describe('ledger reconciliation report mapper', () => {
  it('surfaces mismatch and integrity counts for admin UI', () => {
    const sample: LedgerReconciliationReport = {
      generatedAt: new Date().toISOString(),
      walletBalanceMismatches: [
        {
          walletId: 'w1',
          userId: 'u1',
          currency: 'NGN',
          storedBalance: '100',
          ledgerSum: '90',
          delta: '10',
        },
      ],
      transactionsWithoutLedgerOperation: 3,
      unbalancedLedgerOperations: [{ ledgerOperationId: 'op1', reference: 'r1', debitTotal: '1', creditTotal: '2' }],
      shortLedgerOperations: [{ ledgerOperationId: 'op2', reference: 'r2', legCount: 1 }],
    };
    const s = summarizeReport(sample);
    expect(s.mismatchCount).toBe(1);
    expect(s.legacyLegs).toBe(3);
    expect(s.unbalanced).toBe(1);
    expect(s.short).toBe(1);
  });
});
