import { Currency, TransactionDirection, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  canonicalizeLegsForFingerprint,
  fingerprintFromLegInputs,
  hashLegFingerprint,
} from './ledger-fingerprint.util';

describe('ledger-fingerprint.util', () => {
  it('stable fingerprint for same legs regardless of input order', () => {
    const a = [
      {
        walletId: 'w1',
        userId: 'u1',
        direction: TransactionDirection.DEBIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: new Decimal('10.0000'),
        currency: Currency.NGN,
      },
      {
        walletId: 'w2',
        userId: null,
        direction: TransactionDirection.CREDIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: new Decimal('10.0000'),
        currency: Currency.NGN,
      },
    ];
    const b = [...a].reverse();
    expect(fingerprintFromLegInputs(a)).toBe(fingerprintFromLegInputs(b));
  });

  it('different economics produce different fingerprints', () => {
    const base = {
      walletId: 'w1',
      userId: 'u1',
      direction: TransactionDirection.DEBIT,
      type: TransactionType.WALLET_TOP_UP,
      currency: Currency.NGN,
    };
    const fp1 = fingerprintFromLegInputs([
      { ...base, amount: new Decimal('10') },
      {
        walletId: 'w2',
        direction: TransactionDirection.CREDIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: new Decimal('10'),
        currency: Currency.NGN,
      },
    ]);
    const fp2 = fingerprintFromLegInputs([
      { ...base, amount: new Decimal('11') },
      {
        walletId: 'w2',
        direction: TransactionDirection.CREDIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: new Decimal('11'),
        currency: Currency.NGN,
      },
    ]);
    expect(fp1).not.toBe(fp2);
  });

  it('hashLegFingerprint is deterministic for sorted canonical legs', () => {
    const sorted = canonicalizeLegsForFingerprint([
      {
        walletId: 'a',
        amount: new Decimal('1'),
        direction: TransactionDirection.CREDIT,
        type: TransactionType.ROI,
        currency: Currency.NGN,
      },
      {
        walletId: 'b',
        amount: new Decimal('1'),
        direction: TransactionDirection.DEBIT,
        type: TransactionType.ROI,
        currency: Currency.NGN,
      },
    ]);
    expect(hashLegFingerprint(sorted)).toBe(hashLegFingerprint([...sorted]));
  });
});
