import { describe, expect, it } from 'vitest';
import { formatDecimalMoneyForDisplay, sumDecimalStrings, sumMoneyDecimalStrings } from './format-display';

describe('formatDecimalMoneyForDisplay', () => {
  it('formats high-precision decimal strings without parseFloat', () => {
    const s = formatDecimalMoneyForDisplay('1234.5678', 'NGN');
    expect(s).toContain('1,234.57');
    expect(s).toMatch(/^₦/);
  });

  it('handles negative decimal strings', () => {
    expect(formatDecimalMoneyForDisplay('-10.005', 'NGN')).toContain('-');
  });
});

describe('sumMoneyDecimalStrings', () => {
  it('adds high-precision strings without floating-point error', () => {
    expect(sumMoneyDecimalStrings('0.1', '0.2')).toBe('0.3000');
    expect(sumMoneyDecimalStrings('999999.9999', '0.0001')).toBe('1000000.0000');
  });
});

describe('sumDecimalStrings', () => {
  it('sums a list of decimal strings', () => {
    expect(sumDecimalStrings(['1.0000', '2.5000', '0.0001'])).toBe('3.5001');
  });
});
