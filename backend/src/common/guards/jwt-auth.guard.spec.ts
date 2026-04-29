import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = {
    verify: jest.fn(),
  } as unknown as JwtService;
  const configService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'config.jwt.accessSecret': 'access-secret-012345678901234567890123',
        'config.jwt.issuer': 'cohold-api',
        'config.jwt.audience': 'cohold-client',
      };
      return map[key];
    }),
  } as unknown as ConfigService;
  const prisma = {
    user: { findUnique: jest.fn() },
  } as any;

  const guard = new JwtAuthGuard(jwtService, configService, prisma);

  const makeContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      const map: Record<string, string> = {
        'config.jwt.accessSecret': 'access-secret-012345678901234567890123',
        'config.jwt.issuer': 'cohold-api',
        'config.jwt.audience': 'cohold-client',
      };
      return map[key];
    });
  });

  it('rejects when Authorization header is missing', async () => {
    const request: Record<string, any> = { headers: {}, cookies: {} };
    const context = makeContext(request);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when Bearer token is empty', async () => {
    const request: Record<string, any> = {
      headers: { authorization: 'Bearer   ' },
      cookies: {},
    };
    const context = makeContext(request);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates using Bearer access token', async () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'user-1',
      role: 'user',
      tokenType: 'access',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerifiedAt: new Date(),
      isFrozen: false,
    });
    const request: Record<string, any> = {
      headers: { authorization: 'Bearer jwt-token' },
      cookies: {},
    };
    const context = makeContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: 'user' });
  });
});
