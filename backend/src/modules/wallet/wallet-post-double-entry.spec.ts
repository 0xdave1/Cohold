import { ConflictException } from '@nestjs/common';
import {
  Currency,
  LedgerOperationType,
  Prisma,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { WalletService } from './wallet.service';
import { fingerprintFromLegInputs } from './ledger-fingerprint.util';

const baseLegs = () => [
  {
    walletId: 'w-debit',
    userId: 'u1',
    type: TransactionType.WALLET_TOP_UP,
    direction: TransactionDirection.DEBIT,
    amount: new Decimal('5.0000'),
    currency: Currency.NGN,
    netAmount: new Decimal('5.0000'),
  },
  {
    walletId: 'w-credit',
    userId: 'u1',
    type: TransactionType.WALLET_TOP_UP,
    direction: TransactionDirection.CREDIT,
    amount: new Decimal('5.0000'),
    currency: Currency.NGN,
    netAmount: new Decimal('5.0000'),
  },
];

describe('WalletService.postDoubleEntry (Issue 3)', () => {
  const walletService = new WalletService({} as never, {} as never, { notifyWalletFunded: jest.fn() } as never);

  it('returns created:false when LedgerOperation already exists with matching fingerprint', async () => {
    const legs = baseLegs();
    const fp = fingerprintFromLegInputs(legs);
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'w-debit' }]),
      ledgerOperation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'op-1',
          legFingerprint: fp,
          transactions: [
            { id: 't1', ledgerLegIndex: 0 },
            { id: 't2', ledgerLegIndex: 1 },
          ],
        }),
      },
    };

    const out = await walletService.postDoubleEntry(tx as never, 'idem-ref', legs, {
      operationType: LedgerOperationType.WALLET_FUNDING,
    });
    expect(out.created).toBe(false);
    expect(out.legs).toHaveLength(2);
    expect(tx.ledgerOperation.findUnique).toHaveBeenCalled();
  });

  it('throws ConflictException when reference exists with different fingerprint', async () => {
    const legs = baseLegs();
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'w-debit' }]),
      ledgerOperation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'op-1',
          legFingerprint: 'v1:not-the-same',
          transactions: [{ id: 't1' }, { id: 't2' }],
        }),
      },
    };

    await expect(
      walletService.postDoubleEntry(tx as never, 'idem-ref', legs, {
        operationType: LedgerOperationType.WALLET_FUNDING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails closed on insufficient balance when conditional debit updates zero rows', async () => {
    const legs = baseLegs();
    const ledgerCreate = jest.fn().mockResolvedValue({ id: 'new-op' });
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'w-debit' }]),
      ledgerOperation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: ledgerCreate,
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      $executeRawUnsafe: jest.fn(async (sql: string) => {
        if (sql.includes('balance -') && sql.includes('balance >=')) {
          return 0;
        }
        return 1;
      }),
    };

    await expect(
      walletService.postDoubleEntry(tx as unknown as Prisma.TransactionClient, 'new-ref', legs, {
        operationType: LedgerOperationType.WALLET_FUNDING,
      }),
    ).rejects.toThrow(/Insufficient wallet balance/);

    expect(ledgerCreate).toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).toHaveBeenCalled();
  });
});
