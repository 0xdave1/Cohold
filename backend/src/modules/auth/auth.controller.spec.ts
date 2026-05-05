import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    refresh: jest.fn(),
    getCookieDomain: jest.fn().mockReturnValue(undefined),
    requestPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
  } as any;
  const controller = new AuthController(authService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('refresh fails when refresh cookie is missing', async () => {
    const req = {
      cookies: {},
      headers: {},
      ip: '127.0.0.1',
    } as any;
    const res = {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    } as any;

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('forgot-password returns same message for any email (no enumeration)', async () => {
    const msg = await controller.forgotPassword({ email: 'exists@example.com' });
    expect(msg.message).toMatch(/If an account exists/i);
    expect(authService.requestPasswordResetOtp).toHaveBeenCalledWith('exists@example.com');

    authService.requestPasswordResetOtp.mockClear();
    const msg2 = await controller.forgotPassword({ email: 'missing@example.com' });
    expect(msg2.message).toBe(msg.message);
    expect(authService.requestPasswordResetOtp).toHaveBeenCalledWith('missing@example.com');
  });
});

