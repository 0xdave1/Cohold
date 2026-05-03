/** Response shape from GET /admin/ledger/reconciliation (backend Issue 3). */
export type LedgerReconciliationReport = {
  generatedAt: string;
  walletBalanceMismatches: Array<{
    walletId: string;
    userId: string;
    currency: string;
    storedBalance: string;
    ledgerSum: string;
    delta: string;
  }>;
  transactionsWithoutLedgerOperation: number;
  unbalancedLedgerOperations: Array<{
    ledgerOperationId: string;
    reference: string;
    debitTotal: string;
    creditTotal: string;
  }>;
  shortLedgerOperations: Array<{
    ledgerOperationId: string;
    reference: string;
    legCount: number;
  }>;
};
