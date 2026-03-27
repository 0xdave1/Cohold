import Decimal from 'decimal.js';

/** Matches backend `InvestmentStatus.ACTIVE` — COMPLETED/CANCELLED excluded from portfolio aggregates. */
export function isActiveInvestmentStatus(status?: string | null): boolean {
  return (status ?? 'ACTIVE') === 'ACTIVE';
}

/** Principal + credited ROI for a position (matches backend ledger semantics). */
export function investmentPositionValue(amount: string, totalReturns?: string | null): string {
  const a = new Decimal(amount || '0');
  const returnsRaw = totalReturns == null || totalReturns === '' ? '0' : totalReturns;
  const r = new Decimal(returnsRaw);
  return a.plus(r).toFixed(4);
}

export function sumActivePortfolioValue(
  items: Array<{ status?: string; currency: string; amount: string; totalReturns?: string | null }>,
  currency: string,
): string {
  let sum = new Decimal(0);
  for (const i of items) {
    if (!isActiveInvestmentStatus(i.status) || i.currency !== currency) continue;
    sum = sum.plus(new Decimal(investmentPositionValue(i.amount, i.totalReturns)));
  }
  return sum.toFixed(4);
}

export function sumActiveShares(
  items: Array<{ status?: string; currency: string; shares: string }>,
  currency: string,
): string {
  let sum = new Decimal(0);
  for (const i of items) {
    if (!isActiveInvestmentStatus(i.status) || i.currency !== currency) continue;
    sum = sum.plus(new Decimal(i.shares || '0'));
  }
  return sum.toFixed(8);
}

export function countActiveAssets(
  items: Array<{ status?: string; currency: string }>,
  currency: string,
): number {
  return items.filter((i) => isActiveInvestmentStatus(i.status) && i.currency === currency).length;
}
