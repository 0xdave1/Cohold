import Decimal from 'decimal.js';
import { INVESTMENT_FEE_RATE } from '@/lib/constants/investment';

export function investmentPrincipal(shares: Decimal, sharePrice: Decimal): Decimal {
  return shares.mul(sharePrice).toDecimalPlaces(8, Decimal.ROUND_DOWN);
}

export function platformFee(principal: Decimal): Decimal {
  return principal.mul(INVESTMENT_FEE_RATE).toDecimalPlaces(4, Decimal.ROUND_DOWN);
}

export function totalWithFee(principal: Decimal): Decimal {
  return principal.plus(platformFee(principal)).toDecimalPlaces(4, Decimal.ROUND_DOWN);
}

/**
 * Simple annual projection: principal × annualYield (unitless, e.g. 0.125).
 * Returns 0 when yield unknown — never invent a rate in UI.
 */
export function projectedAnnualReturn(principal: Decimal, annualYield?: string | null): Decimal {
  if (annualYield == null || annualYield === '') return new Decimal(0);
  const y = new Decimal(annualYield);
  if (!y.isFinite() || y.lte(0)) return new Decimal(0);
  return principal.mul(y).toDecimalPlaces(4, Decimal.ROUND_DOWN);
}
