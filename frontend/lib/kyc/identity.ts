const MIN_ID_MASK_LEN = 6;

export function maskSensitiveId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (cleaned.includes('*')) return cleaned;
  const digitsOnly = cleaned.replace(/\D/g, '');
  const source = digitsOnly.length > 0 ? digitsOnly : cleaned;
  if (source.length <= 4) return '*'.repeat(Math.max(source.length, 1));
  const visibleTail = source.slice(-4);
  const maskedLen = Math.max(source.length - 4, MIN_ID_MASK_LEN - 4);
  return `${'*'.repeat(maskedLen)}${visibleTail}`;
}
