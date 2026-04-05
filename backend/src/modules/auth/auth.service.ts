import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { Currency } from '@prisma/client';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly cacheService: CacheService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isFrozen) throw new UnauthorizedException('Account is disabled');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

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

    return { accessToken, refreshToken };
  }

  /** Request a 6-digit OTP and send via email */
  async requestOtp(email: string, purpose: 'signup' | 'login' | 'transaction' | 'delete_account' = 'signup') {
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `otp:${email}:${purpose}`;
    await this.cacheService.set(cacheKey, otp, 600); // 10 minutes

    await this.emailService.sendOtpEmail(
      email,
      otp,
      purpose === 'transaction' ? 'transaction' : 'verification',
    );
  }

  /** Verify OTP from cache */
  async verifyOtp(dto: VerifyOtpDto, purpose: 'signup' | 'login' | 'transaction' | 'delete_account' = 'signup'): Promise<boolean> {
    const cacheKey = `otp:${dto.email}:${purpose}`;
    const storedOtp = await this.cacheService.get<string>(cacheKey);

    if (!storedOtp || storedOtp !== dto.otp) throw new UnauthorizedException('Invalid or expired OTP');

    await this.cacheService.del(cacheKey);
    return true;
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

    return { accessToken, refreshToken };
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

      if (payload.role === 'user') {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, emailVerifiedAt: true, isFrozen: true },
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
      }

      const tokenBody =
        payload.role === 'user'
          ? { sub: payload.sub, role: payload.role, ev: true as const }
          : { sub: payload.sub, role: payload.role };

      const newAccessToken = await this.jwtService.signAsync(tokenBody, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      });

      return { accessToken: newAccessToken, refreshToken };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Frontend uses purpose 'login' when requesting OTP for reset.
    await this.verifyOtp({ email: dto.email, otp: dto.otp } as VerifyOtpDto, 'login');

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