/** Display API unitless annual yield (e.g. 0.125) as percentage string. */
export function formatAnnualYieldPercent(annualYield: string | number | null | undefined): string {
  if (annualYield == null || annualYield === '') return '0%';
  const n = typeof annualYield === 'number' ? annualYield : Number(annualYield);
  if (!Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
