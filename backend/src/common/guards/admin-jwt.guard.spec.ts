import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminJwtGuard } from './admin-jwt.guard';

describe('AdminJwtGuard', () => {
  const jwtService = { verify: jest.fn() } as unknown as JwtService;
  const configService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'config.jwt.adminAccessSecret': 'admin-access-secret-012345678901234567890',
        'config.jwt.adminIssuer': 'cohold-api',
        'config.jwt.adminAudience': 'cohold-admin-panel',
      };
      return map[key];
    }),
  } as unknown as ConfigService;
  const prisma = {
    adminSession: { findFirst: jest.fn() },
    admin: { findUnique: jest.fn() },
  } as any;

  const guard = new AdminJwtGuard(jwtService, configService, prisma);

  const makeContext = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects user_access-shaped payload', async () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'u1',
      email: 'a@b.com',
      role: 'user',
      sessionId: 's1',
      tokenType: 'user_access',
    });
    prisma.adminSession.findFirst.mockResolvedValue({ id: 's1' });
    prisma.admin.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'DATA_UPLOADER',
      accountStatus: 'ACTIVE',
    });
    const req = { headers: { authorization: 'Bearer t' }, user: undefined };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
