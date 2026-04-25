import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthOtpService } from './auth-otp.service';
import { AuthAttemptsService } from './auth-attempts.service';

describe('AuthService session security', () => {
  let service: AuthService;
  const prismaMock = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    wallet: { createMany: jest.fn() },
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const configMock = {
    get: jest.fn((key: string) => {
      const table: Record<string, string | number> = {
        'config.jwt.accessSecret': 'access-secret-012345678901234567890123',
        'config.jwt.refreshSecret': 'refresh-secret-0123456789012345678901',
        'config.jwt.accessExpiresIn': '15m',
        'config.jwt.refreshExpiresIn': '7d',
        'config.jwt.issuer': 'cohold-api',
        'config.jwt.audience': 'cohold-client',
        'config.jwt.sessionPepper': 'pepper-secret',
        'config.jwt.maxSessionLifetimeDays': 30,
      };
      return table[key];
    }),
  };
  const attemptsMock = {
    assertEmailNotLockedForLogin: jest.fn(),
    recordLoginFailure: jest.fn(),
    reset: jest.fn(),
    assertEmailNotLockedForOtpRequest: jest.fn(),
    recordOtpRequest: jest.fn().mockResolvedValue(0),
    assertEmailNotLockedForOtpVerify: jest.fn(),
    recordOtpVerifyFailure: jest.fn(),
    assertNotLockedTxnOtpVerify: jest.fn(),
    recordTxnOtpVerifyFailure: jest.fn(),
  };
  const otpMock = {
    storeTxnOtp: jest.fn(),
    storeEmailOtp: jest.fn(),
    readTxnOtp: jest.fn(),
    consumeTxnOtp: jest.fn(),
    readEmailOtp: jest.fn(),
    consumeEmailOtp: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    configMock.get.mockImplementation((key: string) => {
      const table: Record<string, string | number> = {
        'config.jwt.accessSecret': 'access-secret-012345678901234567890123',
        'config.jwt.refreshSecret': 'refresh-secret-0123456789012345678901',
        'config.jwt.accessExpiresIn': '15m',
        'config.jwt.refreshExpiresIn': '7d',
        'config.jwt.issuer': 'cohold-api',
        'config.jwt.audience': 'cohold-client',
        'config.jwt.sessionPepper': 'pepper-secret',
        'config.jwt.maxSessionLifetimeDays': 30,
      };
      return table[key];
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: EmailService, useValue: { sendOtpEmail: jest.fn(), sendWelcomeEmail: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: { notifyWelcome: jest.fn() },
        },
        { provide: AuthOtpService, useValue: otpMock },
        { provide: AuthAttemptsService, useValue: attemptsMock },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  function userFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: bcrypt.hashSync('Password123', 10),
      isFrozen: false,
      emailVerifiedAt: new Date(),
      username: null,
      ...overrides,
    };
  }

  it('login creates a hashed refresh session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    prismaMock.authSession.create.mockResolvedValue({});

    const session = await service.login({ email: 'user@example.com', password: 'Password123' });

    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(prismaMock.authSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: expect.any(String),
        }),
      }),
    );
  });

  it('refresh rotates token and revokes previous session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    prismaMock.authSession.create.mockResolvedValue({});
    const first = await service.login({ email: 'user@example.com', password: 'Password123' });

    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 'sid-1',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      userAgent: 'test-agent',
    });

    const rotated = await service.refresh(first.refreshToken);
    expect(rotated.refreshToken).not.toEqual(first.refreshToken);
    expect(prismaMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sid-1' } }),
    );
    expect(prismaMock.authSession.create).toHaveBeenCalledTimes(2);
  });

  it('reused refresh token is rejected and all sessions revoked', async () => {
    prismaMock.authSession.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    const token = await new JwtService().signAsync(
      { sub: 'user-1', role: 'user', ev: true, tokenType: 'refresh', sid: 'sid-1' },
      {
        secret: 'refresh-secret-0123456789012345678901',
        issuer: 'cohold-api',
        audience: 'cohold-client',
      },
    );

    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.authSession.updateMany).toHaveBeenCalled();
    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'REFRESH_REUSE' }),
      }),
    );
  });

  it('refresh rejects session past max lifetime and revokes it', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    const token = await new JwtService().signAsync(
      { sub: 'user-1', role: 'user', ev: true, tokenType: 'refresh', sid: 'sid-2' },
      {
        secret: 'refresh-secret-0123456789012345678901',
        issuer: 'cohold-api',
        audience: 'cohold-client',
      },
    );
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 'sid-2',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      userAgent: 'test-agent',
    });

    await expect(service.refresh(token, { userAgent: 'test-agent' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prismaMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sid-2' } }),
    );
    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SESSION_REVOKED' }),
      }),
    );
  });

  it('refresh logs user agent mismatch event', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    prismaMock.authSession.create.mockResolvedValue({});
    const token = await new JwtService().signAsync(
      { sub: 'user-1', role: 'user', ev: true, tokenType: 'refresh', sid: 'sid-3' },
      {
        secret: 'refresh-secret-0123456789012345678901',
        issuer: 'cohold-api',
        audience: 'cohold-client',
      },
    );
    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 'sid-3',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      userAgent: 'old-agent',
    });

    await service.refresh(token, { userAgent: 'new-agent' });

    expect(prismaMock.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'USER_AGENT_MISMATCH' }),
      }),
    );
  });

  it('logout current session revokes only current token hash', async () => {
    const token = 'sample-refresh-token';
    await service.logoutCurrentSession('user-1', token);
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          isRevoked: false,
        }),
      }),
    );
  });

  it('logout-all revokes all active sessions', async () => {
    await service.logoutAllSessions('user-1');
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', isRevoked: false },
      }),
    );
  });

  it('password reset revokes active sessions', async () => {
    jest.spyOn(service, 'verifyOtp').mockResolvedValue(true);
    prismaMock.user.findUnique.mockResolvedValue(userFixture());
    prismaMock.$transaction.mockImplementation(async (fn: any) =>
      fn({
        user: { update: jest.fn() },
        authSession: { updateMany: jest.fn() },
      }),
    );

    await service.resetPassword({
      email: 'user@example.com',
      otp: '123456',
      newPassword: 'NewPassword123',
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('frozen user cannot login or refresh', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture({ isFrozen: true }));
    await expect(
      service.login({ email: 'user@example.com', password: 'Password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('unverified user is blocked from login', async () => {
    prismaMock.user.findUnique.mockResolvedValue(userFixture({ emailVerifiedAt: null }));
    await expect(
      service.login({ email: 'user@example.com', password: 'Password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
