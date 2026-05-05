import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Currency, Prisma, SecurityEventType } from '@prisma/client';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthOtpService, type OtpPurpose } from './auth-otp.service';
import { AuthAttemptsService } from './auth-attempts.service';
import { createHash, randomUUID } from 'crypto';

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceLabel?: string | null;
};

type JwtUserPayload = {
  sub: string;
  email?: string;
  role: 'user';
  ev: true;
  tokenType: 'user_access' | 'user_refresh';
  sid?: string;
  jti?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly otpStore: AuthOtpService,
    private readonly attempts: AuthAttemptsService,
  ) {}

  getCookieDomain(): string | undefined {
    const raw = this.configService.get<string>('config.app.cookieDomain') ?? '';
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private getJwtConfig() {
    const accessSecret = this.configService.get<string>('config.jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('config.jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('config.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('config.jwt.refreshExpiresIn') ?? '7d';
    const issuer = this.configService.get<string>('config.jwt.issuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.audience') ?? 'cohold-client';
    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException('JWT not configured');
    }
    return { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn, issuer, audience };
  }

  private hashRefreshToken(refreshToken: string): string {
    const pepper =
      this.configService.get<string>('config.jwt.sessionPepper') ??
      this.configService.get<string>('AUTH_SESSION_PEPPER') ??
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      '';
    return createHash('sha256').update(`${refreshToken}:${pepper}`).digest('hex');
  }

  private async signAccessToken(userId: string, email: string): Promise<string> {
    const { accessSecret, accessExpiresIn, issuer, audience } = this.getJwtConfig();
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        role: 'user',
        ev: true,
        tokenType: 'user_access',
      } satisfies JwtUserPayload,
      {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
        algorithm: 'HS256',
        issuer,
        audience,
      },
    );
  }

  private async createRefreshSession(
    userId: string,
    context?: SessionContext,
    email?: string | null,
  ) {
    const { refreshSecret, refreshExpiresIn, issuer, audience } = this.getJwtConfig();
    const sid = randomUUID();
    const jti = randomUUID();
    const resolvedEmail =
      email ??
      (
        await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })
      )?.email;
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        ...(resolvedEmail ? { email: resolvedEmail } : {}),
        role: 'user',
        ev: true,
        tokenType: 'user_refresh',
        sid,
        jti,
      } satisfies JwtUserPayload,
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
        algorithm: 'HS256',
        issuer,
        audience,
      },
    );
    const decoded = await this.jwtService.verifyAsync<JwtUserPayload & { exp: number }>(refreshToken, {
      secret: refreshSecret,
      algorithms: ['HS256'],
      issuer,
      audience,
    });
    const expiresAt = new Date(decoded.exp * 1000);
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.authSession.create({
      data: {
        id: sid,
        userId,
        refreshTokenHash,
        userAgent: context?.userAgent ?? null,
        ipAddress: context?.ipAddress ?? null,
        deviceLabel: context?.deviceLabel ?? null,
        expiresAt,
      },
    });
    return { refreshToken, sessionId: sid, expiresAt };
  }

  private async revokeAllActiveSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  private getMaxSessionLifetimeMs(): number {
    const days = this.configService.get<number>('config.jwt.maxSessionLifetimeDays') ?? 30;
    return days * 24 * 60 * 60 * 1000;
  }

  private async logSecurityEvent(params: {
    type: SecurityEventType;
    userId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.securityEvent.create({
      data: {
        type: params.type,
        userId: params.userId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isFrozen) throw new UnauthorizedException('Account is disabled');

    await this.attempts.assertEmailNotLockedForLogin(email);

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.attempts.recordLoginFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.attempts.reset('login', email.trim().toLowerCase());
    return user;
  }

  async login(dto: LoginDto, context?: SessionContext) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'OTP_NOT_VERIFIED',
        message: 'Please verify your email with the OTP before logging in.',
      });
    }

    const accessToken = await this.signAccessToken(user.id, user.email);
    const { refreshToken } = await this.createRefreshSession(user.id, context, user.email);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.logSecurityEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });
    return { accessToken, refreshToken, requiresUsernameSetup: user.username == null };
  }

  async requestOtp(email: string, purpose: OtpPurpose = 'signup') {
    if (purpose === 'signup') {
      const row = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (!row) {
        throw new BadRequestException(
          'No pending registration found for this email. Please sign up first.',
        );
      }
      if (row.emailVerifiedAt) {
        throw new BadRequestException('This email is already verified. Please log in instead.');
      }
    } else {
      const row = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (!row) throw new BadRequestException('No account found for this email.');
      if (!row.emailVerifiedAt) {
        throw new BadRequestException({
          code: 'OTP_NOT_VERIFIED',
          message:
            'Please verify your email with the OTP sent during signup before using this flow.',
        });
      }
    }

    await this.attempts.assertEmailNotLockedForOtpRequest(purpose, email);
    const reqCount = await this.attempts.recordOtpRequest(purpose, email);
    if (reqCount >= 3) {
      this.logger.warn(`OTP request threshold reached for ${purpose}:${email}`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSeconds = 600;

    if (purpose === 'transaction') {
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) throw new BadRequestException('No account found for this email.');
      await this.otpStore.storeTxnOtp(user.id, otp, ttlSeconds);
    } else {
      await this.otpStore.storeEmailOtp(purpose === 'login' ? 'login' : purpose, email, otp, ttlSeconds);
    }

    await this.emailService.sendOtpEmail(
      email,
      otp,
      purpose === 'transaction' ? 'transaction' : 'verification',
    );
  }

  async verifyOtp(dto: VerifyOtpDto, purpose: OtpPurpose = 'signup'): Promise<boolean> {
    await this.attempts.assertEmailNotLockedForOtpVerify(purpose, dto.email);

    if (purpose === 'transaction') {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('No account found for this email.');
      const stored = await this.otpStore.readTxnOtp(user.id);
      if (!stored || stored !== dto.otp) {
        await this.attempts.recordOtpVerifyFailure(purpose, dto.email);
        throw AuthAttemptsService.invalidOtp();
      }
      await this.otpStore.consumeTxnOtp(user.id);
      await this.attempts.reset('otp-verify', `${purpose}:${dto.email.trim().toLowerCase()}`);
      return true;
    }

    const storedOtp = await this.otpStore.readEmailOtp(purpose, dto.email);
    if (!storedOtp || storedOtp !== dto.otp) {
      await this.attempts.recordOtpVerifyFailure(purpose, dto.email);
      throw AuthAttemptsService.invalidOtp();
    }

    await this.otpStore.consumeEmailOtp(purpose, dto.email);
    await this.attempts.reset('otp-verify', `${purpose}:${dto.email.trim().toLowerCase()}`);
    return true;
  }

  async verifyTransactionOtpForUser(userId: string, otp: string): Promise<void> {
    await this.attempts.assertNotLockedTxnOtpVerify(userId);
    const stored = await this.otpStore.readTxnOtp(userId);
    if (!stored || stored !== otp) {
      await this.attempts.recordTxnOtpVerifyFailure(userId);
      throw AuthAttemptsService.invalidOtp();
    }
    await this.otpStore.consumeTxnOtp(userId);
    await this.attempts.reset('txn-otp-verify', userId);
  }

  async signup(
    dto: SignupDto,
  ): Promise<
    | { pendingVerification: true; email: string; message: string }
    | { pendingVerification: false; message: string; email: string }
  > {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      if (existingUser.emailVerifiedAt) {
        throw new BadRequestException('User with this email already exists');
      }
      return {
        pendingVerification: true,
        email: dto.email,
        message:
          'An account with this email is pending verification. Use the code we sent or request a new one.',
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({ data: { email: dto.email, passwordHash } });
    await this.prisma.wallet.createMany({
      data: [
        { userId: user.id, currency: Currency.NGN, balance: 0 },
        { userId: user.id, currency: Currency.USD, balance: 0 },
        { userId: user.id, currency: Currency.GBP, balance: 0 },
        { userId: user.id, currency: Currency.EUR, balance: 0 },
      ],
    });
    await this.requestOtp(dto.email, 'signup');
    return {
      pendingVerification: false,
      message: 'Account created. Please check your email for verification code.',
      email: dto.email,
    };
  }

  async completeSignup(dto: VerifyOtpDto, context?: SessionContext) {
    await this.verifyOtp(dto, 'signup');
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    try {
      await this.notificationsService.notifyWelcome(user.id, user.firstName ?? undefined);
    } catch (err) {
      this.logger.warn(`Failed to send welcome notification: ${err}`);
    }

    const accessToken = await this.signAccessToken(user.id, user.email);
    const { refreshToken } = await this.createRefreshSession(user.id, context, user.email);
    await this.logSecurityEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: { source: 'complete-signup' },
    });
    return { accessToken, refreshToken, requiresUsernameSetup: true };
  }

  async refresh(refreshToken: string, context?: SessionContext) {
    const { refreshSecret, issuer, audience } = this.getJwtConfig();
    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
        issuer,
        audience,
      });
      if (payload.tokenType !== 'user_refresh' || payload.role !== 'user') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, emailVerifiedAt: true, isFrozen: true, username: true },
      });
      if (!user || user.isFrozen) throw new UnauthorizedException('Invalid refresh token');
      if (!user.emailVerifiedAt) {
        throw new UnauthorizedException({
          code: 'OTP_NOT_VERIFIED',
          message: 'Please verify your email with the OTP before logging in.',
        });
      }

      const tokenHash = this.hashRefreshToken(refreshToken);
      const session = await this.prisma.authSession.findFirst({
        where: { userId: payload.sub, refreshTokenHash: tokenHash },
      });

      if (!session || session.isRevoked || session.expiresAt <= new Date()) {
        await this.revokeAllActiveSessions(payload.sub);
        await this.logSecurityEvent({
          type: SecurityEventType.REFRESH_REUSE,
          userId: payload.sub,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
        });
        await this.logSecurityEvent({
          type: SecurityEventType.SESSION_REVOKED,
          userId: payload.sub,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
          metadata: { reason: 'refresh-reuse-detected' },
        });
        throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
      }

      const sessionAgeMs = Date.now() - session.createdAt.getTime();
      if (sessionAgeMs > this.getMaxSessionLifetimeMs()) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: { isRevoked: true, revokedAt: new Date(), lastUsedAt: new Date() },
        });
        await this.logSecurityEvent({
          type: SecurityEventType.SESSION_REVOKED,
          userId: payload.sub,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
          metadata: { reason: 'max-session-lifetime-exceeded' },
        });
        throw new UnauthorizedException('Session expired. Please log in again.');
      }

      const incomingUserAgent = context?.userAgent ?? null;
      if (
        incomingUserAgent &&
        session.userAgent &&
        session.userAgent.trim() !== incomingUserAgent.trim()
      ) {
        await this.logSecurityEvent({
          type: SecurityEventType.USER_AGENT_MISMATCH,
          userId: payload.sub,
          ipAddress: context?.ipAddress ?? null,
          userAgent: incomingUserAgent,
          metadata: { previousUserAgent: session.userAgent },
        });
      }

      const { refreshToken: nextRefreshToken } = await this.createRefreshSession(
        payload.sub,
        context,
        user.email,
      );
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { isRevoked: true, revokedAt: new Date(), lastUsedAt: new Date() },
      });
      const accessToken = await this.signAccessToken(payload.sub, user.email);
      return {
        accessToken,
        refreshToken: nextRefreshToken,
        requiresUsernameSetup: user.username == null,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logoutCurrentSession(userId: string, refreshToken: string) {
    const hash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    await this.prisma.authSession.updateMany({
      where: { userId, refreshTokenHash: hash, isRevoked: false },
      data: { isRevoked: true, revokedAt: now, lastUsedAt: now },
    });
    await this.logSecurityEvent({
      type: SecurityEventType.LOGOUT,
      userId,
    });
    return { message: 'Logged out' };
  }

  async logoutAllSessions(userId: string) {
    await this.revokeAllActiveSessions(userId);
    await this.logSecurityEvent({
      type: SecurityEventType.LOGOUT_ALL,
      userId,
    });
    return { message: 'Logged out of all devices' };
  }

  async listSessions(userId: string, currentRefreshToken?: string | null) {
    const currentHash = currentRefreshToken ? this.hashRefreshToken(currentRefreshToken) : null;
    const now = new Date();
    const rows = await this.prisma.authSession.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        deviceLabel: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        refreshTokenHash: true,
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        deviceLabel: row.deviceLabel,
        lastUsedAt: row.lastUsedAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        isCurrent: currentHash != null && row.refreshTokenHash === currentHash,
      })),
    };
  }

  async getSessionProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
        onboardingCompletedAt: true,
        emailVerifiedAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Session is not active');
    }
    return {
      ...user,
      requiresUsernameSetup: user.username == null,
    };
  }

  async requestPasswordResetOtp(emailRaw: string): Promise<void> {
    await this.attempts.assertEmailNotLockedForOtpRequest('reset', emailRaw);
    await this.attempts.recordOtpRequest('reset', emailRaw);

    const normalized = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.otpStore.storeEmailOtp('reset', user.email, otp, 600);
    await this.emailService.sendOtpEmail(user.email, otp, 'verification');
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      await this.verifyOtp({ email: dto.email, otp: dto.otp } as VerifyOtpDto, 'reset');
    } catch {
      await this.verifyOtp({ email: dto.email, otp: dto.otp } as VerifyOtpDto, 'login');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    });
    await this.logSecurityEvent({
      type: SecurityEventType.PASSWORD_RESET,
      userId: user.id,
    });
    await this.logSecurityEvent({
      type: SecurityEventType.SESSION_REVOKED,
      userId: user.id,
      metadata: { reason: 'password-reset' },
    });
    try {
      await this.emailService.sendPasswordResetSuccessEmail(user.email);
    } catch (err) {
      this.logger.warn(`Failed to send password reset success email user=${user.id}: ${err}`);
    }

    return { message: 'Password reset successful' };
  }
}
