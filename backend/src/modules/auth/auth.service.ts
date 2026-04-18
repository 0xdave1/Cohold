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
import { Currency } from '@prisma/client';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthOtpService, type OtpPurpose } from './auth-otp.service';
import { AuthAttemptsService } from './auth-attempts.service';

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

    // Successful login clears failures for this email.
    await this.attempts.reset('login', email.trim().toLowerCase());

    return user;
  }

  /** Login user and return access & refresh tokens */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'OTP_NOT_VERIFIED',
        message: 'Please verify your email with the OTP before logging in.',
      });
    }

    const payload = { sub: user.id, role: 'user' as const, ev: true as const };
    const accessSecret = this.configService.get<string>('config.jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('config.jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('config.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('config.jwt.refreshExpiresIn') ?? '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken, requiresUsernameSetup: user.username == null };
  }

  /** Request a 6-digit OTP and send via email */
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
      // Login / transaction / delete_account OTPs must never substitute for signup email verification.
      const row = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerifiedAt: true },
      });
      if (!row) {
        throw new BadRequestException('No account found for this email.');
      }
      if (!row.emailVerifiedAt) {
        throw new BadRequestException({
          code: 'OTP_NOT_VERIFIED',
          message:
            'Please verify your email with the OTP sent during signup before using this flow.',
        });
      }
    }

    // Prevent OTP spamming (per-purpose per-email).
    await this.attempts.assertEmailNotLockedForOtpRequest(purpose, email);
    const reqCount = await this.attempts.recordOtpRequest(purpose, email);
    if (reqCount >= 3) {
      // recordOtpRequest already locks when threshold is reached
      this.logger.warn(`OTP request threshold reached for ${purpose}:${email}`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSeconds = 600; // 10 minutes

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

  /** Verify OTP from cache */
  async verifyOtp(dto: VerifyOtpDto, purpose: OtpPurpose = 'signup'): Promise<boolean> {
    // Lockouts for repeated OTP failures.
    await this.attempts.assertEmailNotLockedForOtpVerify(purpose, dto.email);

    if (purpose === 'transaction') {
      // Backwards-compatible: if transaction OTP is verified through this endpoint, look up userId.
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

  /**
   * Verify a transaction-scoped OTP for the authenticated user (email from DB, never from client).
   * Consumes the OTP on success.
   */
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

  /** Signup user (creates account, wallets, and sends OTP) */
  async signup(dto: SignupDto): Promise<{ message: string; email: string }> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      if (existingUser.emailVerifiedAt) {
        throw new BadRequestException('User with this email already exists');
      }
      throw new BadRequestException({
        code: 'SIGNUP_PENDING_VERIFICATION',
        message:
          'An account with this email is pending verification. Use the code we sent or request a new one.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

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
      message: 'Account created. Please check your email for verification code.',
      email: dto.email,
    };
  }

  /** Complete signup after OTP verification */
  async completeSignup(dto: VerifyOtpDto) {
    await this.verifyOtp(dto, 'signup');

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    await this.emailService.sendWelcomeEmail(user.email);

    // Send welcome notification
    try {
      await this.notificationsService.notifyWelcome(user.id, user.firstName ?? undefined);
    } catch (err) {
      this.logger.warn(`Failed to send welcome notification: ${err}`);
    }

    const payload = { sub: user.id, role: 'user' as const, ev: true as const };
    const accessSecret = this.configService.get<string>('config.jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('config.jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('config.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('config.jwt.refreshExpiresIn') ?? '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    return { accessToken, refreshToken, requiresUsernameSetup: true };
  }

  /** Refresh access token using refresh token */
  async refresh(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('config.jwt.refreshSecret');
    const accessSecret = this.configService.get<string>('config.jwt.accessSecret');
    const accessExpiresIn = this.configService.get<string>('config.jwt.accessExpiresIn') ?? '15m';
    if (!refreshSecret || !accessSecret) {
      throw new UnauthorizedException('JWT not configured');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; role: string }>(
        refreshToken,
        { secret: refreshSecret },
      );

      let requiresUsernameSetup = false;
      if (payload.role === 'user') {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, emailVerifiedAt: true, isFrozen: true, username: true },
        });
        if (!user || user.isFrozen) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        if (!user.emailVerifiedAt) {
          throw new UnauthorizedException({
            code: 'OTP_NOT_VERIFIED',
            message: 'Please verify your email with the OTP before logging in.',
          });
        }
        requiresUsernameSetup = user.username == null;
      }

      const tokenBody =
        payload.role === 'user'
          ? { sub: payload.sub, role: payload.role, ev: true as const }
          : { sub: payload.sub, role: payload.role };

      const newAccessToken = await this.jwtService.signAsync(tokenBody, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      });

      return { accessToken: newAccessToken, refreshToken, requiresUsernameSetup };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Prefer reset OTP purpose; keep backwards compatibility with older clients using 'login'.
    try {
      await this.verifyOtp({ email: dto.email, otp: dto.otp } as VerifyOtpDto, 'reset');
    } catch (e) {
      await this.verifyOtp({ email: dto.email, otp: dto.otp } as VerifyOtpDto, 'login');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('User not found');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successful' };
  }

}