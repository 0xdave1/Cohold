/** Strip display formatting; return plain Naira string for API (no commas). */
export function normalizeAmountNairaInput(raw: string): string {
  return raw.replace(/,/g, '').trim();
}

const NAIRA_INPUT_PATTERN = /^(?:[1-9]\d{0,14})(?:\.\d{0,2})?$|^[0-9]\.\d{0,2}$/;

export function isValidWalletFundingNairaInput(raw: string): boolean {
  const clean = normalizeAmountNairaInput(raw);
  if (!clean || !NAIRA_INPUT_PATTERN.test(clean)) return false;
  const num = Number(clean);
  return Number.isFinite(num) && num >= 100;
}

export function walletFundingAmountError(raw: string): string | null {
  const clean = normalizeAmountNairaInput(raw);
  if (!clean) return 'Enter an amount in Naira.';
  if (!NAIRA_INPUT_PATTERN.test(clean)) {
    return 'Use a valid Naira amount with up to 2 decimal places (e.g. 1500 or 1500.50).';
  }
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 100) return 'Minimum funding amount is ₦100.';
  return null;
}
