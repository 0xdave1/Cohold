import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { toDecimal } from './decimal.util';

/** Positive Naira major units: up to 2 decimal places, no commas/scientific notation. */
export const NAIRA_AMOUNT_STRING_PATTERN = /^(?:[1-9]\d{0,14})(?:\.\d{1,2})?$|^[0-9]\.\d{1,2}$/;

export const MIN_WALLET_FUNDING_NAIRA = new Decimal('100');

export function isValidNairaAmountString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || !NAIRA_AMOUNT_STRING_PATTERN.test(trimmed)) return false;
  try {
    const amount = toDecimal(trimmed);
    return amount.gt(0) && amount.decimalPlaces() <= 2;
  } catch {
    return false;
  }
}

export function parseNairaAmountString(value: string, min = MIN_WALLET_FUNDING_NAIRA): Decimal {
  const trimmed = value.trim();
  if (!isValidNairaAmountString(trimmed)) {
    throw new BadRequestException(
      'amountNaira must be a positive Naira amount with at most 2 decimal places (e.g. "1500", "1500.5", "1500.50")',
    );
  }
  const amount = toDecimal(trimmed);
  if (amount.lt(min)) {
    throw new BadRequestException(`Minimum wallet funding amount is ₦${min.toFixed(2)}`);
  }
  return amount;
}

/** Converts validated Naira string to integer kobo for Paystack (no JS float math). */
export function nairaStringToKobo(amountNaira: string): number {
  const amount = parseNairaAmountString(amountNaira);
  const kobo = amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (!kobo.isInteger() || kobo.lte(0)) {
    throw new BadRequestException('Invalid Naira amount for kobo conversion');
  }
  const asNumber = kobo.toNumber();
  if (!Number.isSafeInteger(asNumber)) {
    throw new BadRequestException('Amount exceeds supported range');
  }
  return asNumber;
}

export function koboToNairaDecimal(amountKobo: number | string): Decimal {
  return toDecimal(amountKobo).div(100);
}
