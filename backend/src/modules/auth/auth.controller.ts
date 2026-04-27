import { Body, Controller, Get, Logger, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { ApiTags } from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { randomBytes } from 'crypto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly authService: AuthService) {}

  private debugEnabled(): boolean {
    return process.env.AUTH_DEBUG === '1';
  }

  /**
   * Production (Vercel → Render): SameSite=None + Secure so browsers attach cookies on XHR.
   * Local dev: Lax + non-secure for http://localhost.
   */
  private getTrustedCookieFlags(): { secure: boolean; sameSite: 'none' | 'lax' } {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      return { secure: true, sameSite: 'none' };
    }
    return { secure: false, sameSite: 'lax' };
  }

  /** Sets session cookies; returns CSRF plaintext for JSON body (cross-origin clients cannot read API cookies from JS). */
  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken?: string | null },
  ): string {
    const { secure, sameSite } = this.getTrustedCookieFlags();
    const httpOnlyBase = { httpOnly: true as const, secure, sameSite };

    res.cookie('cohold_access_token', tokens.accessToken, {
      ...httpOnlyBase,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    if (tokens.refreshToken) {
      res.cookie('cohold_refresh_token', tokens.refreshToken, {
        ...httpOnlyBase,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    const csrf = randomBytes(32).toString('hex');
    res.cookie('cohold_csrf_token', csrf, {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return csrf;
  }

  private clearAuthCookies(res: Response) {
    const { secure, sameSite } = this.getTrustedCookieFlags();
    res.clearCookie('cohold_access_token', { httpOnly: true, secure, sameSite, path: '/' });
    res.clearCookie('cohold_refresh_token', {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
    });
    res.clearCookie('cohold_csrf_token', {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
    });
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`login attempt email=${dto.email} ip=${req.ip ?? 'n/a'}`);
    }
    const session = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    const csrfToken = this.setAuthCookies(res, session);
    if (this.debugEnabled()) {
      this.logger.debug(`login success email=${dto.email} cookies_set=access,refresh,csrf`);
    }
    return { requiresUsernameSetup: session.requiresUsernameSetup, csrfToken };
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto, dto.purpose ?? 'signup');
  }

  @Post('complete-signup')
  async completeSignup(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.completeSignup(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    const csrfToken = this.setAuthCookies(res, session);
    return { requiresUsernameSetup: session.requiresUsernameSetup, csrfToken };
  }

  @Post('request-otp')
  async requestOtp(@Body() dto: OtpRequestDto) {
    await this.authService.requestOtp(dto.email, dto.purpose ?? 'signup');
    return { message: 'OTP sent to your email' };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`refresh request hasCookie=${Boolean(req.cookies?.cohold_refresh_token)}`);
    }
    const refreshToken = req.cookies?.cohold_refresh_token;
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    const session = await this.authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    const csrfToken = this.setAuthCookies(res, session);
    if (this.debugEnabled()) {
      this.logger.debug('refresh success cookies_rotated=access,refresh,csrf');
    }
    return { requiresUsernameSetup: session.requiresUsernameSetup, csrfToken };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async session(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const profile = await this.authService.getSessionProfile(user.id);
    return {
      user: profile,
      csrfToken: req.cookies?.cohold_csrf_token ?? null,
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.cohold_refresh_token;
    this.clearAuthCookies(res);
    if (!refreshToken) {
      return { message: 'Logged out' };
    }
    return this.authService.logoutCurrentSession(user.id, refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: { id: string }, @Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return this.authService.logoutAllSessions(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async sessions(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const refreshToken = req.cookies?.cohold_refresh_token ?? null;
    return this.authService.listSessions(user.id, refreshToken);
  }
}
