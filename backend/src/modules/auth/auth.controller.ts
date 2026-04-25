import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
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
  constructor(private readonly authService: AuthService) {}

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken?: string | null },
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const baseOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
    };
    res.cookie('cohold_access_token', tokens.accessToken, {
      ...baseOptions,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    if (tokens.refreshToken) {
      res.cookie('cohold_refresh_token', tokens.refreshToken, {
        ...baseOptions,
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    res.cookie('cohold_csrf_token', randomBytes(32).toString('hex'), {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const opts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
    res.clearCookie('cohold_access_token', { ...opts, path: '/' });
    res.clearCookie('cohold_refresh_token', { ...opts, path: '/api/v1/auth' });
    res.clearCookie('cohold_csrf_token', {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      deviceLabel: null,
    });
    this.setAuthCookies(res, session);
    return { requiresUsernameSetup: session.requiresUsernameSetup };
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
    this.setAuthCookies(res, session);
    return { requiresUsernameSetup: session.requiresUsernameSetup };
  }

  @Post('request-otp')
  async requestOtp(@Body() dto: OtpRequestDto) {
    await this.authService.requestOtp(dto.email, dto.purpose ?? 'signup');
    return { message: 'OTP sent to your email' };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
    this.setAuthCookies(res, session);
    return { requiresUsernameSetup: session.requiresUsernameSetup };
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

