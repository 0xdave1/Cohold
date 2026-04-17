import { Currency } from '@prisma/client';

/**
 * Keep as a list for easy future expansion.
 * Add new currencies here when product support is enabled.
 */
export const SUPPORTED_CURRENCIES = [Currency.NGN] as const;

export function isSupportedCurrency(currency: Currency): boolean {
  return SUPPORTED_CURRENCIES.includes(currency);
}

export function assertSupportedCurrency(currency: Currency) {
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
}
