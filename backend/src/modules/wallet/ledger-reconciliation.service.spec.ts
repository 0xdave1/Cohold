import { TransactionDirection, TransactionStatus } from '@prisma/client';
import { LedgerReconciliationService } from './ledger-reconciliation.service';

describe('LedgerReconciliationService', () => {
  it('detects unbalanced ledger operations and counts legacy transactions', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: {
        count: jest.fn().mockResolvedValue(3),
      },
      ledgerOperation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'op1',
            reference: 'r1',
            transactions: [
              { direction: TransactionDirection.DEBIT, amount: { toString: () => '10' } },
              { direction: TransactionDirection.CREDIT, amount: { toString: () => '5' } },
            ],
          },
          {
            id: 'op2',
            reference: 'r2',
            transactions: [
              { direction: TransactionDirection.DEBIT, amount: { toString: () => '2' } },
              { direction: TransactionDirection.CREDIT, amount: { toString: () => '2' } },
            ],
          },
          {
            id: 'op3',
            reference: 'r3',
            transactions: [{ direction: TransactionDirection.DEBIT, amount: { toString: () => '1' } }],
          },
        ]),
      },
    };

    const svc = new LedgerReconciliationService(prisma as never);
    const report = await svc.buildReport();

    expect(report.transactionsWithoutLedgerOperation).toBe(3);
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: { ledgerOperationId: null, status: TransactionStatus.COMPLETED },
    });
    expect(report.unbalancedLedgerOperations).toHaveLength(1);
    expect(report.unbalancedLedgerOperations[0].ledgerOperationId).toBe('op1');
    expect(report.shortLedgerOperations).toHaveLength(1);
    expect(report.shortLedgerOperations[0].ledgerOperationId).toBe('op3');
  });
});
