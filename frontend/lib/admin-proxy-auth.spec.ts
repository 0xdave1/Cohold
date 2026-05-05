import { describe, expect, it } from 'vitest';
import { isAdminProxyAuthorized } from '@/lib/admin-proxy-auth';
import { ADMIN_REFRESH_COOKIE, USER_REFRESH_COOKIE } from '@/lib/constants/auth-cookies';

describe('isAdminProxyAuthorized', () => {
  it('rejects missing cookie header', () => {
    expect(isAdminProxyAuthorized(undefined)).toBe(false);
    expect(isAdminProxyAuthorized('')).toBe(false);
  });

  it('rejects user-only refresh cookie', () => {
    expect(isAdminProxyAuthorized(`${USER_REFRESH_COOKIE}=abc`)).toBe(false);
  });

  it('accepts admin refresh cookie', () => {
    expect(isAdminProxyAuthorized(`${ADMIN_REFRESH_COOKIE}=secret`)).toBe(true);
    expect(isAdminProxyAuthorized(`foo=1; ${ADMIN_REFRESH_COOKIE}=x; bar=2`)).toBe(true);
  });
});
