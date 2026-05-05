import { describe, expect, it, vi, afterEach } from 'vitest';
import { readCsrfCookieFromDocument } from '@/lib/csrf-cookie';
import { CSRF_COOKIE } from '@/lib/constants/auth-cookies';

describe('readCsrfCookieFromDocument', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns undefined in Node when document is missing', () => {
    expect(typeof document).toBe('undefined');
    expect(readCsrfCookieFromDocument()).toBeUndefined();
  });

  it('parses CSRF cookie value', () => {
    vi.stubGlobal('document', { cookie: `${CSRF_COOKIE}=hello` });
    expect(readCsrfCookieFromDocument()).toBe('hello');
  });
});
