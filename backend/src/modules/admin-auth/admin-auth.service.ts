import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';
import { createHash, randomUUID } from 'crypto';

type AdminAccessJwtPayload = {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
  tokenType: 'admin_access';
};

type AdminRefreshJwtPayload = {
  sub: string;
  sessionId: string;
  jti: string;
  tokenType: 'admin_refresh';
};

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getAdminJwtConfig() {
    const accessSecret = this.configService.get<string>('config.jwt.adminAccessSecret');
    const refreshSecret = this.configService.get<string>('config.jwt.adminRefreshSecret');
    const accessExpiresIn =
      this.configService.get<string>('config.jwt.adminAccessExpiresIn') ??
      this.configService.get<string>('config.jwt.accessExpiresIn') ??
      '15m';
    const refreshExpiresIn =
      this.configService.get<string>('config.jwt.adminRefreshExpiresIn') ??
      this.configService.get<string>('config.jwt.refreshExpiresIn') ??
      '7d';
    const issuer = this.configService.get<string>('config.jwt.adminIssuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.adminAudience') ?? 'cohold-admin-panel';
    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException('Admin JWT not configured');
    }
    return { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn, issuer, audience };
  }

  private hashAdminRefreshToken(refreshToken: string): string {
    const pepper =
      this.configService.get<string>('config.jwt.sessionPepper') ??
      this.configService.get<string>('AUTH_SESSION_PEPPER') ??
      this.configService.get<string>('JWT_ADMIN_REFRESH_SECRET') ??
      '';
    return createHash('sha256').update(`${refreshToken}:${pepper}:admin`).digest('hex');
  }

  private async signAdminAccessToken(
    adminId: string,
    email: string,
    role: string,
    sessionId: string,
  ): Promise<string> {
    const { accessSecret, accessExpiresIn, issuer, audience } = this.getAdminJwtConfig();
    const payload: AdminAccessJwtPayload = {
      sub: adminId,
      email,
      role,
      sessionId,
      tokenType: 'admin_access',
    };
    return this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
      algorithm: 'HS256',
      issuer,
      audience,
    });
  }

  private async createAdminRefreshSession(
    adminId: string,
    email: string,
    role: string,
    context?: SessionContext,
  ): Promise<{ refreshToken: string; sessionId: string; accessToken: string }> {
    const { refreshSecret, refreshExpiresIn, issuer, audience } = this.getAdminJwtConfig();
    const sessionId = randomUUID();
    const jti = randomUUID();
    const refreshPayload: AdminRefreshJwtPayload = {
      sub: adminId,
      sessionId,
      jti,
      tokenType: 'admin_refresh',
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
      algorithm: 'HS256',
      issuer,
      audience,
    });
    const decoded = await this.jwtService.verifyAsync<AdminRefreshJwtPayload & { exp: number }>(refreshToken, {
      secret: refreshSecret,
      algorithms: ['HS256'],
      issuer,
      audience,
    });
    const expiresAt = new Date(decoded.exp * 1000);
    const refreshTokenHash = this.hashAdminRefreshToken(refreshToken);
    await this.prisma.adminSession.create({
      data: {
        id: sessionId,
        adminId,
        refreshTokenHash,
        userAgent: context?.userAgent ?? null,
        ipAddress: context?.ipAddress ?? null,
        expiresAt,
      },
    });
    const accessToken = await this.signAdminAccessToken(adminId, email, role, sessionId);
    return { refreshToken, sessionId, accessToken };
  }

  private async revokeAllAdminSessions(adminId: string) {
    await this.prisma.adminSession.updateMany({
      where: { adminId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async login(dto: AdminLoginDto, context?: SessionContext) {
    const invalidCredentialsError = new UnauthorizedException('Invalid credentials');

    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        accountStatus: true,
      },
    });

    if (!admin) {
      throw invalidCredentialsError;
    }

    if (admin.accountStatus !== 'ACTIVE') {
      throw invalidCredentialsError;
    }

    const passwordValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordValid) {
      throw invalidCredentialsError;
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const { refreshToken, accessToken } = await this.createAdminRefreshSession(
      admin.id,
      admin.email,
      admin.role,
      context,
    );
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, context?: SessionContext) {
    const { refreshSecret, issuer, audience } = this.getAdminJwtConfig();
    let payload: AdminRefreshJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminRefreshJwtPayload>(refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
        issuer,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'admin_refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, accountStatus: true },
    });
    if (!admin || admin.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashAdminRefreshToken(refreshToken);
    const session = await this.prisma.adminSession.findFirst({
      where: { id: payload.sessionId, adminId: payload.sub, refreshTokenHash: tokenHash },
    });

    if (!session || session.isRevoked || session.expiresAt <= new Date()) {
      await this.revokeAllAdminSessions(payload.sub);
      throw new UnauthorizedException('Admin refresh token reuse detected. Please log in again.');
    }

    const { refreshToken: nextRefresh, accessToken } = await this.createAdminRefreshSession(
      admin.id,
      admin.email,
      admin.role,
      context,
    );
    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: { isRevoked: true, revokedAt: new Date(), lastUsedAt: new Date() },
    });
    return { accessToken, refreshToken: nextRefresh };
  }

  async logoutSession(adminId: string, sessionId: string) {
    const now = new Date();
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, adminId, isRevoked: false },
      data: { isRevoked: true, revokedAt: now, lastUsedAt: now },
    });
    return { message: 'Logged out' };
  }

  async getSessionProfile(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        accountStatus: true,
      },
    });
    if (!admin || admin.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Session is not active');
    }
    return admin;
  }
}
