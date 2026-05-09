import { describe, expect, it } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  axiosQueryRetryPredicate,
  mapApiError,
  sanitizeBackendMessage,
} from '@/lib/api/security-errors';

function axiosErr(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): AxiosError {
  const config = { url: '/test' } as InternalAxiosRequestConfig;
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    {
      data,
      status,
      statusText: 'Err',
      headers,
      config,
    },
  );
}

describe('sanitizeBackendMessage', () => {
  it('replaces Prisma-like internals with generic server message', () => {
    const raw = 'PrismaClientKnownRequestError: Unique at prisma.engine (internal)';
    expect(sanitizeBackendMessage(raw)).toContain('Something went wrong');
  });

  it('masks long digit sequences and bearer tokens', () => {
    const s = sanitizeBackendMessage(
      'BVN 12345678901 failed token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
    );
    expect(s).not.toContain('12345678901');
    expect(s).toContain('***');
    expect(s).toContain('Bearer ***');
  });

  it('preserves short benign messages', () => {
    expect(sanitizeBackendMessage('Not found')).toBe('Not found');
  });
});

describe('mapApiError', () => {
  it('maps 429 to retry-later copy and parses Retry-After', () => {
    const e = axiosErr(429, {}, { 'retry-after': '90' });
    const m = mapApiError(e);
    expect(m.kind).toBe('rate_limited');
    expect(m.message.toLowerCase()).toContain('too many');
    expect(m.retryAfterSeconds).toBe(90);
  });

  it('maps CSRF mismatch on 400', () => {
    const e = axiosErr(400, { error: { message: 'CSRF token mismatch' } });
    const m = mapApiError(e);
    expect(m.kind).toBe('csrf');
    expect(m.message.toLowerCase()).toContain('session');
  });

  it('maps 500 to generic message', () => {
    const e = axiosErr(500, { error: { message: 'Internal stack trace at foo (bar)' } });
    const m = mapApiError(e);
    expect(m.kind).toBe('server');
    expect(m.message).toContain('Something went wrong');
  });
});

describe('axiosQueryRetryPredicate', () => {
  it('returns false for 429', () => {
    expect(axiosQueryRetryPredicate(0, axiosErr(429, {}), 2)).toBe(false);
  });

  it('returns false for 401', () => {
    expect(axiosQueryRetryPredicate(0, axiosErr(401, {}), 2)).toBe(false);
  });

  it('allows limited retries for unknown errors', () => {
    expect(axiosQueryRetryPredicate(0, new Error('network'), 2)).toBe(true);
    expect(axiosQueryRetryPredicate(2, new Error('network'), 2)).toBe(false);
  });
});
