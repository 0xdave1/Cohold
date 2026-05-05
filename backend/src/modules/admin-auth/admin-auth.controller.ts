import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Request, Response } from 'express';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { ConfigService } from '@nestjs/config';

/** Isolated from end-user refresh cookie (`cohold_refresh_token`). */
export const ADMIN_REFRESH_COOKIE = 'cohold_admin_refresh';

@ApiTags('admin-auth')
@Controller('admin-auth')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly configService: ConfigService,
  ) {}

  private debugEnabled(): boolean {
    return process.env.AUTH_DEBUG === '1';
  }

  private cookieDomain(): string | undefined {
    const raw = this.configService.get<string>('config.app.cookieDomain') ?? '';
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
  }

  private getAdminRefreshCookieOptions(): { secure: boolean; sameSite: 'lax' | 'strict'; domain?: string } {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = this.cookieDomain();
    if (isProd) {
      return { secure: true, sameSite: 'lax', ...(domain ? { domain } : {}) };
    }
    return { secure: false, sameSite: 'lax', ...(domain ? { domain } : {}) };
  }

  private setAdminRefreshCookie(res: Response, refreshToken: string): void {
    const { secure, sameSite, domain } = this.getAdminRefreshCookieOptions();
    res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
    });
  }

  private clearAdminAuthCookies(res: Response): void {
    const { secure, sameSite, domain } = this.getAdminRefreshCookieOptions();
    const base = { secure, sameSite, path: '/' as const, ...(domain ? { domain } : {}) };
    res.clearCookie(ADMIN_REFRESH_COOKIE, { httpOnly: true, ...base });
  }

  @Post('login')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin login attempt email=${dto.email}`);
    }
    const tokens = await this.adminAuthService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
    this.setAdminRefreshCookie(res, tokens.refreshToken);
    if (this.debugEnabled()) {
      this.logger.debug(`admin login success email=${dto.email}`);
    }
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin refresh hasCookie=${Boolean(req.cookies?.[ADMIN_REFRESH_COOKIE])}`);
    }
    const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) {
      this.clearAdminAuthCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.adminAuthService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });
    this.setAdminRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  async logout(
    @CurrentUser() user: { id: string; sessionId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminAuthService.logoutSession(user.id, user.sessionId);
    this.clearAdminAuthCookies(res);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  async getMe(@CurrentUser() user: { id: string }) {
    const admin = await this.adminAuthService.getSessionProfile(user.id);
    return { user: admin };
  }

  @Get('session')
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  async getSession(@CurrentUser() user: { id: string }) {
    const admin = await this.adminAuthService.getSessionProfile(user.id);
    return { user: admin };
  }
}
