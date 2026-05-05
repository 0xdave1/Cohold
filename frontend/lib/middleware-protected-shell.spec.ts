import { describe, expect, it } from 'vitest';
import { getAuthMiddlewareRedirect, isAdminPublicPath } from '@/lib/middleware-auth';

/**
 * "Shell" protection is enforced by Edge middleware before RSC/segment render.
 * These tests assert redirect URLs — not DOM — for enforceable deployment modes.
 */
describe('middleware protected shell (redirect before render)', () => {
  it('unauthenticated /dashboard yields login redirect when gating is enforceable (same-origin API)', () => {
    const r = getAuthMiddlewareRedirect(
      '/dashboard/home',
      { has: () => false },
      'https://cohold.co/dashboard/home',
      { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://cohold.co/api/v1' },
    );
    expect(r).toContain('/login');
    expect(r).toContain('next=');
  });

  it('unauthenticated /admin yields admin login redirect when gating is enforceable', () => {
    const r = getAuthMiddlewareRedirect(
      '/admin/dashboard',
      { has: () => false },
      'https://cohold.co/admin/dashboard',
      { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://cohold.co/api/v1' },
    );
    expect(r).toBe('https://cohold.co/admin/login');
  });

  it('/admin/login stays public under production same-origin', () => {
    expect(isAdminPublicPath('/admin/login')).toBe(true);
    expect(
      getAuthMiddlewareRedirect('/admin/login', { has: () => false }, 'https://cohold.co/admin/login', {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://cohold.co/api/v1',
      }),
    ).toBeNull();
  });

  it('production cross-origin does not silently skip: misconfiguration redirect', () => {
    const r = getAuthMiddlewareRedirect(
      '/dashboard',
      { has: () => false },
      'https://app.deployed.com/d',
      { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'https://api.deployed.com/api/v1' },
    );
    expect(r).toMatch(/first_party_session_required/);
  });
});
