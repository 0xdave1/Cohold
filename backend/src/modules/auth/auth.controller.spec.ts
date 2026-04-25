import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    refresh: jest.fn(),
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
});

