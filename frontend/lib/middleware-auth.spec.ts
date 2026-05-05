import { afterEach, describe, expect, it } from 'vitest';
import {
  firstPartySiteSessionEnabled,
  getAuthMiddlewareRedirect,
  isAdminProtectedPath,
  isAdminPublicPath,
  isDashboardProtectedPath,
  productionRequiresFirstPartyWhenApiCrossOrigin,
  shouldEnforceRefreshCookieGate,
} from '@/lib/middleware-auth';
import {
  ADMIN_REFRESH_COOKIE,
  ADMIN_SITE_SESSION_COOKIE,
  USER_REFRESH_COOKIE,
  USER_SITE_SESSION_COOKIE,
} from '@/lib/constants/auth-cookies';

const sameOriginEnv = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_API_URL: 'https://cohold.co/api/v1',
} as const;

const crossDevEnv = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
} as const;

describe('middleware-auth', () => {
  afterEach(() => {
    // no global env mutation — all tests pass explicit env into getAuthMiddlewareRedirect
  });

  it('treats /admin/login as public', () => {
    expect(isAdminPublicPath('/admin/login')).toBe(true);
    expect(isAdminProtectedPath('/admin/login')).toBe(false);
  });

  it('protects other /admin paths', () => {
    expect(isAdminProtectedPath('/admin/dashboard')).toBe(true);
    expect(isDashboardProtectedPath('/dashboard')).toBe(true);
  });

  it('redirects /dashboard without user session when same-origin API gate applies', () => {
    const noCookies = { has: () => false };
    const r = getAuthMiddlewareRedirect('/dashboard', noCookies, 'https://cohold.co/dashboard', {
      ...sameOriginEnv,
    });
    expect(r).toContain('/login');
    expect(r).toContain('next=%2Fdashboard');
  });

  it('allows /dashboard when user refresh cookie present (same-origin API)', () => {
    const cookies = { has: (n: string) => n === USER_REFRESH_COOKIE };
    expect(
      getAuthMiddlewareRedirect('/dashboard/wallet', cookies, 'https://cohold.co/dashboard/wallet', {
        ...sameOriginEnv,
      }),
    ).toBeNull();
  });

  it('redirects /admin without admin refresh when same-origin API', () => {
    const noCookies = { has: () => false };
    const r = getAuthMiddlewareRedirect('/admin/users', noCookies, 'https://cohold.co/admin/users', {
      ...sameOriginEnv,
    });
    expect(r).toBe('https://cohold.co/admin/login');
  });

  it('allows /admin/login without cookies', () => {
    const noCookies = { has: () => false };
    expect(
      getAuthMiddlewareRedirect('/admin/login', noCookies, 'https://cohold.co/admin/login', { ...sameOriginEnv }),
    ).toBeNull();
  });

  it('allows admin when admin refresh cookie present (same-origin API)', () => {
    const cookies = { has: (n: string) => n === ADMIN_REFRESH_COOKIE };
    expect(
      getAuthMiddlewareRedirect('/admin/dashboard', cookies, 'https://cohold.co/admin/dashboard', {
        ...sameOriginEnv,
      }),
    ).toBeNull();
  });

  it('skips cookie gate in development when API is cross-origin and first-party is off', () => {
    const noCookies = { has: () => false };
    expect(
      getAuthMiddlewareRedirect('/dashboard', noCookies, 'http://localhost:3001/dashboard', { ...crossDevEnv }),
    ).toBeNull();
  });

  it('production + cross-origin API without first-party flag fails loudly (dashboard)', () => {
    const noCookies = { has: () => false };
    const r = getAuthMiddlewareRedirect('/dashboard', noCookies, 'https://app.example.com/d', {
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.other.com/api/v1',
    });
    expect(r).toContain('/login');
    expect(r).toContain('first_party_session_required');
  });

  it('production + cross-origin API without first-party flag fails loudly (admin)', () => {
    const noCookies = { has: () => false };
    const r = getAuthMiddlewareRedirect('/admin/users', noCookies, 'https://app.example.com/admin/users', {
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.other.com/api/v1',
    });
    expect(r).toContain('/admin/login');
    expect(r).toContain('first_party_session_required');
  });

  it('production cross-origin with first-party enabled gates /dashboard on site marker only', () => {
    const env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_API_URL: 'https://api.other.com/api/v1',
      NEXT_FIRST_PARTY_SESSION_COOKIES: '1',
    };
    expect(
      getAuthMiddlewareRedirect('/dashboard', { has: () => false }, 'https://app.example.com/d', env),
    ).toContain('/login');
    const cookies = { has: (n: string) => n === USER_SITE_SESSION_COOKIE };
    expect(getAuthMiddlewareRedirect('/dashboard', cookies, 'https://app.example.com/d', env)).toBeNull();
  });

  it('firstPartySiteSessionEnabled helper', () => {
    expect(firstPartySiteSessionEnabled({ NODE_ENV: 'production', NEXT_FIRST_PARTY_SESSION_COOKIES: '1' })).toBe(
      true,
    );
    expect(firstPartySiteSessionEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('productionRequiresFirstPartyWhenApiCrossOrigin is false when same-origin API', () => {
    expect(
      productionRequiresFirstPartyWhenApiCrossOrigin(
        { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://cohold.co/api/v1' },
        'https://cohold.co',
      ),
    ).toBe(false);
  });

  it('shouldEnforceRefreshCookieGate matches origins', () => {
    expect(shouldEnforceRefreshCookieGate('https://cohold.co', 'https://cohold.co/api/v1')).toBe(true);
    expect(shouldEnforceRefreshCookieGate('http://localhost:3001', 'http://localhost:4000/api/v1')).toBe(false);
  });
});
