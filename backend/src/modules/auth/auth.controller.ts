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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly authService: AuthService) {}

  private debugEnabled(): boolean {
    return process.env.AUTH_DEBUG === '1';
  }

  /**
   * Cross-site refresh cookie: SameSite=None + Secure. Local: Lax + non-secure.
   * Refresh token only — no access token in cookies; no manual domain unless env set.
   */
  private getRefreshCookieOptions(): {
    secure: boolean;
    sameSite: 'none' | 'lax';
    domain?: string;
  } {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = this.authService.getCookieDomain();
    if (isProd) {
      return { secure: true, sameSite: 'none', ...(domain ? { domain } : {}) };
    }
    return { secure: false, sameSite: 'lax', ...(domain ? { domain } : {}) };
  }

  /** HttpOnly refresh cookie only (host-only unless AUTH_COOKIE_DOMAIN is set). */
  private setRefreshCookie(res: Response, refreshToken: string): void {
    const { secure, sameSite, domain } = this.getRefreshCookieOptions();
    res.cookie('cohold_refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
    });
  }

  /** Clear refresh + legacy access/CSRF cookies from prior deployments. */
  private clearSessionCookies(res: Response): void {
    const { secure, sameSite, domain } = this.getRefreshCookieOptions();
    const base = { secure, sameSite, path: '/' as const, ...(domain ? { domain } : {}) };
    res.clearCookie('cohold_refresh_token', { httpOnly: true, ...base });
    res.clearCookie('cohold_access_token', { httpOnly: true, ...base });
    res.clearCookie('cohold_csrf_token', { httpOnly: false, ...base });
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(
        `login attempt email=${dto.email} ip=${req.ip ?? 'n/a'} origin=${String(req.headers.origin ?? 'n/a')} ua=${String(req.headers['user-agent'] ?? 'n/a')}`,
      );
    }
    const session = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    this.setRefreshCookie(res, session.refreshToken);
    if (this.debugEnabled()) {
      this.logger.debug(`login success email=${dto.email} refresh_cookie_set=1`);
    }
    return {
      accessToken: session.accessToken,
      requiresUsernameSetup: session.requiresUsernameSetup,
    };
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('resend-otp')
  async resendOtp(@Body() dto: OtpRequestDto) {
    await this.authService.requestOtp(dto.email, dto.purpose ?? 'signup');
    return { message: 'OTP resent to your email' };
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
    this.setRefreshCookie(res, session.refreshToken);
    return {
      accessToken: session.accessToken,
      requiresUsernameSetup: session.requiresUsernameSetup,
    };
  }

  @Post('request-otp')
  async requestOtp(@Body() dto: OtpRequestDto) {
    await this.authService.requestOtp(dto.email, dto.purpose ?? 'signup');
    return { message: 'OTP sent to your email' };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(
        `refresh request origin=${String(req.headers.origin ?? 'n/a')} hasRefreshCookie=${Boolean(req.cookies?.cohold_refresh_token)} cookieHeaderPresent=${Boolean(req.headers.cookie)}`,
      );
    }
    const refreshToken = req.cookies?.cohold_refresh_token;
    if (!refreshToken) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    const session = await this.authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    this.setRefreshCookie(res, session.refreshToken);
    if (this.debugEnabled()) {
      this.logger.debug('refresh success refresh_cookie_rotated=1');
    }
    return {
      accessToken: session.accessToken,
      requiresUsernameSetup: session.requiresUsernameSetup,
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async session(@CurrentUser() user: { id: string }) {
    const profile = await this.authService.getSessionProfile(user.id);
    return { user: profile };
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
    this.clearSessionCookies(res);
    if (!refreshToken) {
      return { message: 'Logged out' };
    }
    return this.authService.logoutCurrentSession(user.id, refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: { id: string }, @Res({ passthrough: true }) res: Response) {
    this.clearSessionCookies(res);
    return this.authService.logoutAllSessions(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async sessions(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const refreshToken = req.cookies?.cohold_refresh_token ?? null;
    return this.authService.listSessions(user.id, refreshToken);
  }
}
