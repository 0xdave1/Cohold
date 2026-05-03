import { describe, expect, it } from 'vitest';
import { formatSharesQuantityForDisplay } from './portfolio';

describe('formatSharesQuantityForDisplay', () => {
  it('formats share decimal strings without Number()', () => {
    expect(formatSharesQuantityForDisplay('1234.56780000')).toBe('1,234.5678');
    expect(formatSharesQuantityForDisplay('10.0000')).toBe('10');
  });
});
