import { Body, Controller, Get, Logger, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@ApiTags('admin-auth')
@Controller('admin-auth')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);
  constructor(private readonly adminAuthService: AdminAuthService) {}

  private debugEnabled(): boolean {
    return process.env.AUTH_DEBUG === '1';
  }

  private getTrustedCookieFlags(): { secure: boolean; sameSite: 'none' | 'lax' } {
    const isProd = process.env.NODE_ENV === 'production';
    return isProd ? { secure: true, sameSite: 'none' } : { secure: false, sameSite: 'lax' };
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken?: string | null },
  ): string {
    const { secure, sameSite } = this.getTrustedCookieFlags();
    const base = { httpOnly: true as const, secure, sameSite };

    res.cookie('cohold_access_token', tokens.accessToken, {
      ...base,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    if (tokens.refreshToken) {
      res.cookie('cohold_refresh_token', tokens.refreshToken, {
        ...base,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    const csrfToken = randomBytes(32).toString('hex');
    res.cookie('cohold_csrf_token', csrfToken, {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return csrfToken;
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
  async login(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin login attempt email=${dto.email}`);
    }
    const tokens = await this.adminAuthService.login(dto);
    const csrfToken = this.setAuthCookies(res, tokens);
    if (this.debugEnabled()) {
      this.logger.debug(`admin login success email=${dto.email} cookies_set=access,refresh,csrf`);
    }
    return { csrfToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin refresh hasCookie=${Boolean(req.cookies?.cohold_refresh_token)}`);
    }
    const refreshToken = req.cookies?.cohold_refresh_token;
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.adminAuthService.refresh(refreshToken);
    const csrfToken = this.setAuthCookies(res, tokens);
    return { csrfToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async session(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const admin = await this.adminAuthService.getSessionProfile(user.id);
    return {
      user: admin,
      csrfToken: req.cookies?.cohold_csrf_token ?? null,
    };
  }
}

