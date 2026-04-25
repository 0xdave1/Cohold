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
});

