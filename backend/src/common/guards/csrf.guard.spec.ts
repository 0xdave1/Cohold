import { BadRequestException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  const makeContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  it('allows GET without csrf token', () => {
    const context = makeContext({
      method: 'GET',
      originalUrl: '/api/v1/users/me',
      cookies: {},
      headers: {},
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects POST without matching csrf token', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/users/me/profile-photo/complete',
      cookies: { cohold_csrf_token: 'cookie-token' },
      headers: {},
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('allows POST with matching csrf token', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/users/me/profile-photo/complete',
      cookies: { cohold_csrf_token: 'same-token' },
      headers: { 'x-csrf-token': 'same-token' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('exempts Flutterwave webhook POST without csrf', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/webhooks/flutterwave',
      cookies: {},
      headers: {},
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('does not exempt arbitrary webhook subpaths', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/webhooks/other-provider',
      cookies: {},
      headers: {},
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('does not exempt prefix attacks under /api/v1/auth/', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/auth/evil-mutation',
      cookies: { cohold_csrf_token: 'a' },
      headers: { 'x-csrf-token': 'b' },
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
  });

  it('allows POST when Authorization Bearer is present (API clients)', () => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/wallets/transfer',
      cookies: {},
      headers: { authorization: 'Bearer access-token-here' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});

