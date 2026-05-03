import { createHash } from 'crypto';
import {
  Currency,
  Transaction,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { toDecimal } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';

export type LegFingerprintCanon = {
  walletId: string;
  userId: string | null;
  direction: TransactionDirection;
  type: TransactionType;
  amount: string;
  currency: Currency;
  fee: string | null;
  netAmount: string | null;
  propertyId: string | null;
  investmentId: string | null;
  externalReference: string | null;
};

export type LegFingerprintInput = {
  walletId: string;
  userId?: string | null;
  direction: TransactionDirection;
  type: TransactionType;
  amount: Decimal;
  currency: Currency;
  fee?: Decimal | null;
  netAmount?: Decimal | null;
  propertyId?: string | null;
  investmentId?: string | null;
  externalReference?: string | null;
};

export function canonicalizeLegsForFingerprint(legs: LegFingerprintInput[]): LegFingerprintCanon[] {
  return legs
    .map((l) => ({
      walletId: l.walletId,
      userId: l.userId ?? null,
      direction: l.direction,
      type: l.type,
      amount: moneyStr(fixMoney(l.amount)),
      currency: l.currency,
      fee: l.fee != null ? moneyStr(fixMoney(l.fee)) : null,
      netAmount: l.netAmount != null ? moneyStr(fixMoney(l.netAmount)) : null,
      propertyId: l.propertyId ?? null,
      investmentId: l.investmentId ?? null,
      externalReference: l.externalReference ?? null,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function hashLegFingerprint(sorted: LegFingerprintCanon[]): string {
  const payload = JSON.stringify({ v: 1, legs: sorted });
  return `v1:${createHash('sha256').update(payload).digest('hex')}`;
}

export function fingerprintFromLegInputs(legs: LegFingerprintInput[]): string {
  return hashLegFingerprint(canonicalizeLegsForFingerprint(legs));
}

export function fingerprintFromPostedTransactions(
  rows: Array<
    Pick<
      Transaction,
      | 'walletId'
      | 'userId'
      | 'direction'
      | 'type'
      | 'amount'
      | 'currency'
      | 'fee'
      | 'netAmount'
      | 'propertyId'
      | 'investmentId'
      | 'externalReference'
    >
  >,
): string {
  const canon: LegFingerprintCanon[] = rows.map((t) => ({
    walletId: t.walletId!,
    userId: t.userId ?? null,
    direction: t.direction,
    type: t.type,
    amount: moneyStr(fixMoney(toDecimal(t.amount.toString()))),
    currency: t.currency,
    fee: t.fee != null ? moneyStr(fixMoney(toDecimal(t.fee.toString()))) : null,
    netAmount: t.netAmount != null ? moneyStr(fixMoney(toDecimal(t.netAmount.toString()))) : null,
    propertyId: t.propertyId ?? null,
    investmentId: t.investmentId ?? null,
    externalReference: t.externalReference ?? null,
  }));
  canon.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return hashLegFingerprint(canon);
}
