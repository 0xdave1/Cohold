import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';

describe('Issue 4 — cross-domain JWT rejection', () => {
  const userSecret = 'user-access-secret-01234567890123456789012';
  const adminSecret = 'admin-access-secret-0123456789012345678901';
  const issuer = 'cohold-api';
  const userAud = 'cohold-client';
  const adminAud = 'cohold-admin-panel';

  const jwt = new JwtService();
  const prisma = {
    user: { findUnique: jest.fn() },
    adminSession: { findFirst: jest.fn() },
    admin: { findUnique: jest.fn() },
  } as any;

  const userConfig = {
    get: (k: string) =>
      ({
        'config.jwt.accessSecret': userSecret,
        'config.jwt.issuer': issuer,
        'config.jwt.audience': userAud,
      })[k],
  } as unknown as ConfigService;

  const adminConfig = {
    get: (k: string) =>
      ({
        'config.jwt.adminAccessSecret': adminSecret,
        'config.jwt.adminIssuer': issuer,
        'config.jwt.adminAudience': adminAud,
      })[k],
  } as unknown as ConfigService;

  const makeCtx = (req: any) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'u@test.com',
      emailVerifiedAt: new Date(),
      isFrozen: false,
    });
    prisma.adminSession.findFirst.mockResolvedValue({
      id: 'sid',
      adminId: 'a1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.admin.findUnique.mockResolvedValue({
      id: 'a1',
      email: 'admin@test.com',
      role: 'SUPER_ADMIN',
      accountStatus: 'ACTIVE',
    });
  });

  it('user guard rejects refresh token used as access', async () => {
    const refreshTok = await jwt.signAsync(
      {
        sub: 'u1',
        email: 'u@test.com',
        role: 'user',
        ev: true,
        tokenType: 'user_refresh',
        sid: 's',
        jti: 'j',
      },
      { secret: userSecret, issuer, audience: userAud, algorithm: 'HS256' },
    );
    const guard = new JwtAuthGuard(jwt, userConfig, prisma);
    await expect(
      guard.canActivate(makeCtx({ headers: { authorization: `Bearer ${refreshTok}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('admin guard rejects user access token', async () => {
    const userAccess = await jwt.signAsync(
      { sub: 'u1', email: 'u@test.com', role: 'user', ev: true, tokenType: 'user_access' },
      { secret: userSecret, issuer, audience: userAud, algorithm: 'HS256' },
    );
    const guard = new AdminJwtGuard(jwt, adminConfig, prisma);
    await expect(
      guard.canActivate(makeCtx({ headers: { authorization: `Bearer ${userAccess}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('user guard rejects wrong audience', async () => {
    const bad = await jwt.signAsync(
      { sub: 'u1', email: 'u@test.com', role: 'user', ev: true, tokenType: 'user_access' },
      { secret: userSecret, issuer, audience: adminAud, algorithm: 'HS256' },
    );
    const guard = new JwtAuthGuard(jwt, userConfig, prisma);
    await expect(
      guard.canActivate(makeCtx({ headers: { authorization: `Bearer ${bad}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
