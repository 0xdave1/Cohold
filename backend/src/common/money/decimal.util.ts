import Decimal from 'decimal.js';
import { MONEY_DP, SHARE_DP } from './precision.constants';

Decimal.set({
  precision: 24,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export type MoneyString = string;

export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (typeof value === 'number') {
    // Avoid using numbers for money; prefer strings.
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

export function formatMoney(value: Decimal): MoneyString {
  return value.toDecimalPlaces(MONEY_DP, Decimal.ROUND_DOWN).toFixed(MONEY_DP);
}

export function formatHighPrecision(value: Decimal): MoneyString {
  return value.toDecimalPlaces(SHARE_DP, Decimal.ROUND_DOWN).toFixed(SHARE_DP);
}

