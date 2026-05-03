import Decimal from 'decimal.js';

/**
 * Display-only sum of two backend decimal strings (e.g. principal + flat fee).
 * Does not mutate submitted payloads; for UI labels only unless the same string is sent to the API as entered.
 */
export function sumMoneyDecimalStrings(a: string, b: string): string {
  return new Decimal(a || '0').plus(new Decimal(b || '0')).toFixed(4);
}

/** Display-only: sum an array of backend decimal strings (e.g. active investment principals). */
export function sumDecimalStrings(values: readonly string[]): string {
  return values.reduce((acc, s) => acc.plus(new Decimal(s || '0')), new Decimal(0)).toFixed(4);
}

/**
 * Display-only money formatting from backend decimal strings.
 * Uses Decimal.js only — no parseFloat / Number for the monetary value.
 */
export function formatDecimalMoneyForDisplay(amount: string | Decimal, currency: string): string {
  const d = typeof amount === 'string' ? new Decimal(amount) : amount;
  if (!d.isFinite()) {
    return '—';
  }
  const rounded = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const fixed = rounded.toFixed(2);
  const neg = fixed.startsWith('-');
  const abs = neg ? fixed.slice(1) : fixed;
  const [intRaw, frac = '00'] = abs.split('.');
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `${neg ? '-' : ''}${grouped}.${frac}`;
  if (currency === 'NGN') {
    return `₦${body}`;
  }
  return `${currency} ${body}`;
}
