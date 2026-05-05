import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type WsSupportActor =
  | { kind: 'user'; userId: string }
  | { kind: 'admin'; adminId: string; canSupport: boolean };

/**
 * Shared Socket.IO access verification (Issue 4). HTTP guards and gateways must stay aligned.
 */
@Injectable()
export class WsAuthTokenVerifier {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns userId when the token is a valid live user_access JWT for /ws/user. */
  async verifyUserAccessSocket(token: string): Promise<string | null> {
    const secret = this.configService.get<string>('config.jwt.accessSecret');
    const issuer = this.configService.get<string>('config.jwt.issuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.audience') ?? 'cohold-client';
    if (!secret) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role?: string;
        tokenType?: string;
      }>(token, { secret, algorithms: ['HS256'], issuer, audience });
      if (payload.tokenType !== 'user_access' || payload.role !== 'user') {
        return null;
      }
      const userId = payload.sub as string;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerifiedAt: true, isFrozen: true },
      });
      if (!user || user.isFrozen || !user.emailVerifiedAt) {
        return null;
      }
      return userId;
    } catch {
      return null;
    }
  }

  /** Returns adminId when the token is a valid live admin_access JWT + session for /ws/admin. */
  async verifyAdminAccessSocket(token: string): Promise<string | null> {
    const secret = this.configService.get<string>('config.jwt.adminAccessSecret');
    const issuer = this.configService.get<string>('config.jwt.adminIssuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.adminAudience') ?? 'cohold-admin-panel';
    if (!secret) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        sessionId?: string;
        tokenType?: string;
        role?: string;
        email?: string;
      }>(token, { secret, algorithms: ['HS256'], issuer, audience });
      if (payload.tokenType !== 'admin_access' || !payload.sessionId || !payload.email || !payload.role) {
        return null;
      }
      const now = new Date();
      const session = await this.prisma.adminSession.findFirst({
        where: {
          id: payload.sessionId,
          adminId: payload.sub,
          isRevoked: false,
          expiresAt: { gt: now },
        },
      });
      if (!session) return null;
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: { accountStatus: true, email: true, role: true },
      });
      if (
        !admin ||
        admin.accountStatus !== 'ACTIVE' ||
        admin.email !== payload.email ||
        admin.role !== payload.role
      ) {
        return null;
      }
      return payload.sub as string;
    } catch {
      return null;
    }
  }

  /** Support namespace: verified end-user or support-capable admin. */
  async verifySupportAccessSocket(token: string): Promise<WsSupportActor | null> {
    const userSecret = this.configService.get<string>('config.jwt.accessSecret');
    const userIssuer = this.configService.get<string>('config.jwt.issuer') ?? 'cohold-api';
    const userAudience = this.configService.get<string>('config.jwt.audience') ?? 'cohold-client';
    const adminSecret = this.configService.get<string>('config.jwt.adminAccessSecret');
    const adminIssuer = this.configService.get<string>('config.jwt.adminIssuer') ?? 'cohold-api';
    const adminAudience = this.configService.get<string>('config.jwt.adminAudience') ?? 'cohold-admin-panel';
    if (!userSecret || !adminSecret) return null;

    let userPayload: { sub: string; tokenType?: string; role?: string } | null = null;
    try {
      userPayload = await this.jwtService.verifyAsync<{ sub: string; tokenType?: string; role?: string }>(token, {
        secret: userSecret,
        algorithms: ['HS256'],
        issuer: userIssuer,
        audience: userAudience,
      });
    } catch {
      userPayload = null;
    }

    if (userPayload?.tokenType === 'user_access' && userPayload.role === 'user') {
      const actorId = userPayload.sub as string;
      const user = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { emailVerifiedAt: true, isFrozen: true },
      });
      if (!user || user.isFrozen || !user.emailVerifiedAt) return null;
      return { kind: 'user', userId: actorId };
    }

    let adminPayload: { sub: string; sessionId?: string; tokenType?: string; role?: string; email?: string } | null =
      null;
    try {
      adminPayload = await this.jwtService.verifyAsync<{
        sub: string;
        sessionId?: string;
        tokenType?: string;
        role?: string;
        email?: string;
      }>(token, {
        secret: adminSecret,
        algorithms: ['HS256'],
        issuer: adminIssuer,
        audience: adminAudience,
      });
    } catch {
      adminPayload = null;
    }

    if (
      adminPayload?.tokenType === 'admin_access' &&
      adminPayload.sessionId &&
      adminPayload.role &&
      adminPayload.email
    ) {
      const now = new Date();
      const session = await this.prisma.adminSession.findFirst({
        where: {
          id: adminPayload.sessionId,
          adminId: adminPayload.sub,
          isRevoked: false,
          expiresAt: { gt: now },
        },
      });
      if (!session) return null;
      const admin = await this.prisma.admin.findUnique({
        where: { id: adminPayload.sub },
        select: { canSupport: true, role: true, accountStatus: true, email: true },
      });
      if (
        !admin ||
        admin.accountStatus !== 'ACTIVE' ||
        admin.email !== adminPayload.email ||
        admin.role !== adminPayload.role
      ) {
        return null;
      }
      const canAccess = !!admin.canSupport || admin.role === 'SUPER_ADMIN';
      if (!canAccess) return null;
      return { kind: 'admin', adminId: adminPayload.sub, canSupport: true };
    }

    return null;
  }
}
