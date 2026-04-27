import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';

type AdminJwtPayload = {
  sub: string;
  role: string;
  tokenType: 'access' | 'refresh';
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

  private async issueAdminTokens(adminId: string, role: string) {
    const { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn, issuer, audience } =
      this.getJwtConfig();
    const accessPayload: AdminJwtPayload = { sub: adminId, role, tokenType: 'access' };
    const refreshPayload: AdminJwtPayload = { sub: adminId, role, tokenType: 'refresh' };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
        algorithm: 'HS256',
        issuer,
        audience,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
        algorithm: 'HS256',
        issuer,
        audience,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async login(dto: AdminLoginDto) {
    const invalidCredentialsError = new UnauthorizedException('Invalid credentials');

    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
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

    return this.issueAdminTokens(admin.id, admin.role);
  }

  async refresh(refreshToken: string) {
    const { refreshSecret, issuer, audience } = this.getJwtConfig();
    let payload: AdminJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminJwtPayload>(refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
        issuer,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, accountStatus: true },
    });
    if (!admin || admin.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueAdminTokens(admin.id, admin.role);
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
