import { Body, Controller, Get, Logger, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Request, Response } from 'express';
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

  private getRefreshCookieOptions(): { secure: boolean; sameSite: 'none' | 'lax'; domain?: string } {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      return { secure: true, sameSite: 'none' };
    }
    return { secure: false, sameSite: 'lax' };
  }

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

  private clearSessionCookies(res: Response): void {
    const { secure, sameSite, domain } = this.getRefreshCookieOptions();
    const base = { secure, sameSite, path: '/' as const, ...(domain ? { domain } : {}) };
    res.clearCookie('cohold_refresh_token', { httpOnly: true, ...base });
    res.clearCookie('cohold_access_token', { httpOnly: true, ...base });
    res.clearCookie('cohold_csrf_token', { httpOnly: false, ...base });
  }

  @Post('login')
  async login(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin login attempt email=${dto.email}`);
    }
    const tokens = await this.adminAuthService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    if (this.debugEnabled()) {
      this.logger.debug(`admin login success email=${dto.email} refresh_cookie_set=1`);
    }
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (this.debugEnabled()) {
      this.logger.debug(`admin refresh hasCookie=${Boolean(req.cookies?.cohold_refresh_token)}`);
    }
    const refreshToken = req.cookies?.cohold_refresh_token;
    if (!refreshToken) {
      this.clearSessionCookies(res);
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.adminAuthService.refresh(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearSessionCookies(res);
    return { message: 'Logged out' };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async session(@CurrentUser() user: { id: string }) {
    const admin = await this.adminAuthService.getSessionProfile(user.id);
    return { user: admin };
  }
}
