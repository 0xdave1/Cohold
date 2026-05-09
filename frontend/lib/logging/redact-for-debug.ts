/**
 * Best-effort redaction for debug logging (not a cryptographic guarantee).
 */
export function redactForDebug(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value
      .replace(/\bBearer\s+[\w.-]+\b/gi, 'Bearer ***')
      .replace(/\b\d{10,16}\b/g, '***');
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactForDebug(v));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('otp') ||
      lower.includes('bvn') ||
      lower.includes('nin') ||
      lower.includes('authorization') ||
      lower.includes('cookie') ||
      lower.includes('accountnumber') ||
      lower.includes('account_number')
    ) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = redactForDebug(v);
  }
  return out;
}
