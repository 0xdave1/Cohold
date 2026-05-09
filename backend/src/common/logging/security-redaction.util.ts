const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'otp',
  'bvn',
  'nin',
  'identity',
  'identityencrypted',
  'identityhash',
  'accountnumber',
  'bankaccount',
  'secret',
  'signature',
  'webhooksecret',
  'flw_secret_key',
  'flutterwave_secret_key',
]);

function maskString(value: string): string {
  if (value.length <= 6) return '[REDACTED]';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) return true;
  return (
    lower.includes('password') ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('otp') ||
    lower.includes('authorization') ||
    lower.includes('cookie') ||
    lower.includes('bvn') ||
    lower.includes('nin') ||
    lower.includes('accountnumber') ||
    lower.includes('signature')
  );
}

export function redactSensitive<T>(input: T): T {
  if (input == null) return input;
  // Only mask string values when the parent key is sensitive (handled in the object branch below).
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => redactSensitive(item)) as T;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldRedactKey(key)) {
      if (typeof value === 'string') out[key] = maskString(value);
      else out[key] = '[REDACTED]';
      continue;
    }
    out[key] = redactSensitive(value);
  }
  return out as T;
}

export function sanitizeErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return redactSensitive(error as Record<string, unknown> | undefined) ?? { message: 'Unknown error' };
}

/** Mask plausible BVN/NIN/bank account digit runs inside arbitrary strings (Issue 11 audit persistence). */
export function redactDigitSequencesInString(value: string): string {
  if (!value) return value;
  return value.replace(/\b\d{10,16}\b/g, '***');
}

function redactDigitSequencesInJson(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactDigitSequencesInString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactDigitSequencesInJson(v));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = redactDigitSequencesInJson(v);
  }
  return out;
}

/**
 * Issue 9 / Issue 11: key-based redaction then digit-sequence masking for JSON persisted on AdminActivityLog.
 */
export function redactJsonForAuditPersistence(value: unknown): unknown {
  const pass1 = redactSensitive(value as Record<string, unknown> | undefined);
  return redactDigitSequencesInJson(pass1);
}

