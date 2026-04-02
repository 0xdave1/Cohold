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

  async validateAdmin(email: string, password: string) {
    // #region agent log
    fetch('http://127.0.0.1:7553/ingest/67cf4f29-4082-4442-9c49-80dc8f1ed126', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f57080' },
      body: JSON.stringify({
        sessionId: 'f57080',
        location: 'admin-auth.service.ts:validateAdmin:entry',
        message: 'before admin.findUnique',
        data: {
          hypothesisId: 'H1',
          emailDomain: email.includes('@') ? email.split('@')[1] : 'invalid',
        },
        timestamp: Date.now(),
        runId: 'pre-fix',
      }),
    }).catch(() => {});
    // #endregion
    let admin;
    try {
      admin = await this.prisma.admin.findUnique({
        where: { email },
        // Backward-compatible select: avoids runtime failures if optional new columns
        // are not yet present in older DB environments.
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7553/ingest/67cf4f29-4082-4442-9c49-80dc8f1ed126', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f57080' },
        body: JSON.stringify({
          sessionId: 'f57080',
          location: 'admin-auth.service.ts:validateAdmin:findUnique-ok',
          message: 'findUnique returned',
          data: { hypothesisId: 'H2', rowFound: !!admin },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
    } catch (e: unknown) {
      // #region agent log
      const prismaCode =
        e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'non-prisma';
      const prismaMeta =
        e && typeof e === 'object' && 'meta' in e
          ? JSON.stringify((e as { meta?: unknown }).meta ?? {})
          : '';
      fetch('http://127.0.0.1:7553/ingest/67cf4f29-4082-4442-9c49-80dc8f1ed126', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f57080' },
        body: JSON.stringify({
          sessionId: 'f57080',
          location: 'admin-auth.service.ts:validateAdmin:findUnique-error',
          message: 'Prisma findUnique failed',
          data: {
            hypothesisId: 'H1',
            prismaCode,
            prismaMeta: prismaMeta.slice(0, 500),
          },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      throw e;
    }

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return admin;
  }

  async login(dto: AdminLoginDto) {
    const admin = await this.validateAdmin(dto.email, dto.password);

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
