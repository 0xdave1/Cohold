import axios, { type AxiosError } from 'axios';

/** Classified API/security failure for UI and routing decisions. */
export type SecurityErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'rate_limited'
  | 'csrf'
  | 'payload_too_large'
  | 'unsupported_media'
  | 'validation'
  | 'conflict'
  | 'server'
  | 'unknown';

export type MappedApiError = {
  kind: SecurityErrorKind;
  /** Safe to show in UI */
  message: string;
  status?: number;
  /** From Retry-After header when present */
  retryAfterSeconds?: number;
  /** Hint: clear user session and send to login */
  shouldClearUserSession?: boolean;
};

const RATE_LIMIT_MESSAGE =
  'Too many requests. Please wait a few minutes before trying again. If you were signing in, wait before resubmitting.';

const CSRF_MESSAGE =
  'Your session security token is missing or out of date. Refresh the page and sign in again if the problem continues.';

const GENERIC_SERVER = 'Something went wrong on our side. Please try again later.';

const FORBIDDEN_MESSAGE =
  'You do not have permission for this action. If you use KYC-gated features, complete verification or check that your account is not restricted.';

function parseRetryAfterSeconds(error: AxiosError): number | undefined {
  const raw = error.response?.headers?.['retry-after'];
  if (raw == null) return undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(String(first), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Remove stack traces, Prisma internals, and long digit sequences that may be identity/account numbers.
 */
export function sanitizeBackendMessage(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let s = input.replace(/\r|\n/g, ' ').trim();
  if (s.length > 500) s = `${s.slice(0, 500)}…`;

  const lower = s.toLowerCase();
  if (
    lower.includes('prisma') ||
    lower.includes('prismaclient') ||
    lower.includes('stack') ||
    /\bat\s+[\w.]+\s*\(/i.test(s) ||
    lower.includes('internal server error') && lower.includes('exception')
  ) {
    return GENERIC_SERVER;
  }

  // Mask plausible BVN/NIN/bank account runs (10–11 digits) and long OTP-like runs
  s = s.replace(/\b\d{10,16}\b/g, '***');
  s = s.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer ***');

  return s.trim();
}

export function classifySecurityError(error: unknown): SecurityErrorKind {
  return mapApiError(error).kind;
}

export function mapApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): MappedApiError {
  if (!axios.isAxiosError(error)) {
    const msg =
      error instanceof Error ? sanitizeBackendMessage(error.message) : sanitizeBackendMessage(String(error));
    return { kind: 'unknown', message: msg || fallback };
  }

  const ax = error as AxiosError<{ success?: boolean; error?: unknown; message?: string }>;
  const status = ax.response?.status;
  const retryAfterSeconds = parseRetryAfterSeconds(ax);

  const rawMsg = extractRawMessage(ax);
  const sanitized = sanitizeBackendMessage(rawMsg);

  if (status === 401) {
    return {
      kind: 'unauthenticated',
      message: sanitized || 'Please sign in to continue.',
      status: 401,
      shouldClearUserSession: true,
    };
  }

  if (status === 403) {
    return {
      kind: 'forbidden',
      message: sanitized || FORBIDDEN_MESSAGE,
      status: 403,
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limited',
      message: RATE_LIMIT_MESSAGE,
      status: 429,
      retryAfterSeconds,
    };
  }

  if (status === 413) {
    return {
      kind: 'payload_too_large',
      message: sanitized || 'The request or file is too large. Try a smaller file or shorter message.',
      status: 413,
    };
  }

  if (status === 415) {
    return {
      kind: 'unsupported_media',
      message: sanitized || 'That file type is not supported. Use an allowed format and try again.',
      status: 415,
    };
  }

  if (status === 409) {
    return {
      kind: 'conflict',
      message: sanitized || 'This request conflicts with existing data. Refresh and try again.',
      status: 409,
    };
  }

  if (status === 422 || status === 400) {
    const lower = rawMsg.toLowerCase();
    if (lower.includes('csrf') || lower.includes('csrf token')) {
      return {
        kind: 'csrf',
        message: CSRF_MESSAGE,
        status,
      };
    }
    return {
      kind: 'validation',
      message: sanitized || 'Please check your input and try again.',
      status,
    };
  }

  if (status != null && status >= 500) {
    return {
      kind: 'server',
      message: GENERIC_SERVER,
      status,
    };
  }

  return {
    kind: 'unknown',
    message: sanitized || fallback,
    status,
    retryAfterSeconds,
  };
}

function extractRawMessage(ax: AxiosError): string {
  const data = ax.response?.data as Record<string, unknown> | undefined;
  if (!data) return ax.message || '';

  const err = data.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m) && typeof m[0] === 'string') return m[0];
  }
  if (typeof data.message === 'string') return data.message;
  return ax.message || '';
}

/** React Query: do not retry client/security failures that will not succeed on repeat. */
export function axiosQueryRetryPredicate(failureCount: number, error: unknown, max = 2): boolean {
  if (axios.isAxiosError(error)) {
    const s = error.response?.status;
    if (s != null && [400, 401, 403, 404, 409, 413, 415, 422, 429].includes(s)) {
      return false;
    }
  }
  return failureCount < max;
}
