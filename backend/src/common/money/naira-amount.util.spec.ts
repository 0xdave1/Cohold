import { BadRequestException } from '@nestjs/common';
import {
  isValidNairaAmountString,
  nairaStringToKobo,
  parseNairaAmountString,
} from './naira-amount.util';

describe('naira-amount.util', () => {
  describe('isValidNairaAmountString / parseNairaAmountString', () => {
    it.each([
      ['1500', '1500'],
      ['1500.5', '1500.5'],
      ['1500.50', '1500.5'],
    ])('accepts %s', (value, normalized) => {
      expect(isValidNairaAmountString(value)).toBe(true);
      expect(parseNairaAmountString(value).toString()).toBe(normalized);
    });

    it.each(['1500.555', '1,500.50', 'abc', '-100', '0', '', '  ', '1e3'])('rejects %s', (value) => {
      expect(isValidNairaAmountString(value)).toBe(false);
      expect(() => parseNairaAmountString(value)).toThrow(BadRequestException);
    });
  });

  describe('nairaStringToKobo', () => {
    it.each([
      ['1500', 150000],
      ['1500.5', 150050],
      ['1500.50', 150050],
    ])('converts %s -> %i kobo', (naira, kobo) => {
      expect(nairaStringToKobo(naira)).toBe(kobo);
    });
  });
});
