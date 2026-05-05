import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthOtpService } from './auth-otp.service';
import { AuthAttemptsService } from './auth-attempts.service';
import { JwtService } from '@nestjs/jwt';
import { VerifyOtpDto } from './dto/verify-otp.dto';

describe('AuthService OTP / reset security', () => {
  let service: AuthService;
  const prismaMock = {
    user: { findUnique: jest.fn() },
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
    recordOtpRequest: jest.fn().mockResolvedValue(1),
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
    attemptsMock.recordOtpRequest.mockResolvedValue(1);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: EmailService, useValue: { sendOtpEmail: jest.fn(), sendWelcomeEmail: jest.fn() } },
        { provide: NotificationsService, useValue: { notifyWelcome: jest.fn() } },
        { provide: AuthOtpService, useValue: otpMock },
        { provide: AuthAttemptsService, useValue: attemptsMock },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('verifyOtp rejects expired or missing OTP (null stored) and records failure', async () => {
    otpMock.readEmailOtp.mockResolvedValue(null);
    await expect(
      service.verifyOtp({ email: 'a@b.co', otp: '000000' } as VerifyOtpDto, 'signup'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(attemptsMock.recordOtpVerifyFailure).toHaveBeenCalledWith('signup', 'a@b.co');
    expect(otpMock.consumeEmailOtp).not.toHaveBeenCalled();
  });

  it('verifyOtp rejects wrong OTP and records failure', async () => {
    otpMock.readEmailOtp.mockResolvedValue('111111');
    await expect(
      service.verifyOtp({ email: 'a@b.co', otp: '000000' } as VerifyOtpDto, 'signup'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(attemptsMock.recordOtpVerifyFailure).toHaveBeenCalled();
  });

  it('verifyOtp consumes OTP on success and resets attempt counter', async () => {
    otpMock.readEmailOtp.mockResolvedValue('123456');
    await service.verifyOtp({ email: 'a@b.co', otp: '123456' } as any, 'signup');
    expect(otpMock.consumeEmailOtp).toHaveBeenCalledWith('signup', 'a@b.co');
    expect(attemptsMock.reset).toHaveBeenCalledWith('otp-verify', 'signup:a@b.co');
  });

  it('verifyOtp rejects reuse after consume', async () => {
    otpMock.readEmailOtp.mockResolvedValueOnce('123456');
    await service.verifyOtp({ email: 'a@b.co', otp: '123456' } as VerifyOtpDto, 'reset');
    otpMock.readEmailOtp.mockResolvedValue(null);
    await expect(
      service.verifyOtp({ email: 'a@b.co', otp: '123456' } as VerifyOtpDto, 'reset'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requestOtp enforces throttle hooks before sending', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      emailVerifiedAt: new Date(),
    });
    await service.requestOtp('a@b.co', 'login');
    expect(attemptsMock.assertEmailNotLockedForOtpRequest).toHaveBeenCalledWith('login', 'a@b.co');
    expect(attemptsMock.recordOtpRequest).toHaveBeenCalledWith('login', 'a@b.co');
    expect(otpMock.storeEmailOtp).toHaveBeenCalled();
  });

  it('requestPasswordResetOtp always records request counter (throttle) even if user missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await service.requestPasswordResetOtp('ghost@example.com');
    expect(attemptsMock.assertEmailNotLockedForOtpRequest).toHaveBeenCalledWith('reset', 'ghost@example.com');
    expect(attemptsMock.recordOtpRequest).toHaveBeenCalledWith('reset', 'ghost@example.com');
    expect(otpMock.storeEmailOtp).not.toHaveBeenCalled();
  });
});
