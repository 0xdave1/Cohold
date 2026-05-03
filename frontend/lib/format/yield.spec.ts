import { describe, expect, it } from 'vitest';
import { formatAnnualYieldPercent } from './yield';

describe('formatAnnualYieldPercent', () => {
  it('formats string ratios without Number()', () => {
    expect(formatAnnualYieldPercent('0.125')).toBe('12.5%');
    expect(formatAnnualYieldPercent('0.1')).toBe('10%');
  });
});
