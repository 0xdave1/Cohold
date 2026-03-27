import Decimal from 'decimal.js';

/** Wallet balances, transaction amounts, fees — matches DB NUMERIC(19,4). */
export const MONEY_DP = 4;

/** Share quantities — matches DB NUMERIC(24,8). */
export const SHARE_DP = 8;

/** Ownership % display — matches DB NUMERIC(10,6). */
export const OWNERSHIP_DP = 6;

/** Consistent DOWN rounding for all money amounts (never inflate user credits or platform liability). */
export function fixMoney(d: Decimal): Decimal {
  return d.toDecimalPlaces(MONEY_DP, Decimal.ROUND_DOWN);
}

/** Consistent DOWN rounding for share counts. */
export function fixShare(d: Decimal): Decimal {
  return d.toDecimalPlaces(SHARE_DP, Decimal.ROUND_DOWN);
}

export function fixOwnership(d: Decimal): Decimal {
  return d.toDecimalPlaces(OWNERSHIP_DP, Decimal.ROUND_DOWN);
}

export function moneyStr(d: Decimal): string {
  return fixMoney(d).toFixed(MONEY_DP);
}

export function shareStr(d: Decimal): string {
  return fixShare(d).toFixed(SHARE_DP);
}
