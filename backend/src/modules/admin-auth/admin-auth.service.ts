import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

    const payload = { sub: admin.id, role: admin.role as string };
    const accessSecret = this.configService.get<string>('config.jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('config.jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('config.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('config.jwt.refreshExpiresIn') ?? '7d';

    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException('JWT not configured');
    }

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
}
