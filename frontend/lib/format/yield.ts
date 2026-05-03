import Decimal from 'decimal.js';

/** Display API unitless annual yield (e.g. 0.125) as percentage string (display-only, not wallet money). */
export function formatAnnualYieldPercent(annualYield: string | number | null | undefined): string {
  if (annualYield == null || annualYield === '') return '0%';
  const d = new Decimal(annualYield);
  if (!d.isFinite()) return '0%';
  const pct = d.times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1).replace(/\.0$/, '');
  return `${pct}%`;
}
