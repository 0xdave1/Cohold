/**
 * Defensive masking for admin UI — never trust backend shape alone.
 */

const SENSITIVE_KEYS = new Set([
  'bvn',
  'nin',
  'refreshToken',
  'refreshTokenHash',
  'passwordHash',
  'authorization',
  'cookie',
  'set-cookie',
  'webhookSecret',
  'secret',
  'token',
  'accessToken',
  'documentKey',
  'documentFrontKey',
  'documentBackKey',
  'selfieKey',
  'storageKey',
  's3Key',
  'payload',
]);

export function maskBankAccountNumber(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '—';
  const last4 = digits.slice(-4);
  return `••••${last4}`;
}

export function maskIdentityDigits(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const s = String(value).replace(/\s/g, '');
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

/** Redact common secret patterns inside arbitrary strings (e.g. error messages). */
export function redactInlineSecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer ***')
    .replace(/\b\d{10,16}\b/g, '***');
}

export function sanitizeObjectForDisplay(input: unknown, maxDepth = 4): unknown {
  if (maxDepth <= 0) return '[truncated]';
  if (input == null) return input;
  if (typeof input === 'string') return redactInlineSecrets(input);
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((x) => sanitizeObjectForDisplay(x, maxDepth - 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.has(lower) || lower.includes('secret') || lower.includes('token')) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = sanitizeObjectForDisplay(v, maxDepth - 1);
  }
  return out;
}
