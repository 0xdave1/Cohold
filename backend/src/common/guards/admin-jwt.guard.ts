import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type AdminAccessJwtPayload = {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
  tokenType: 'admin_access';
};

@Injectable()
export class AdminJwtGuard implements CanActivate {
  private readonly logger = new Logger(AdminJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      if (process.env.AUTH_DEBUG === '1') {
        this.logger.debug(`admin jwt: missing bearer path=${String(request.originalUrl ?? request.url ?? '')}`);
      }
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const secret = this.configService.get<string>('config.jwt.adminAccessSecret');
    const issuer = this.configService.get<string>('config.jwt.adminIssuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.adminAudience') ?? 'cohold-admin-panel';
    if (!secret) {
      throw new UnauthorizedException('Admin JWT not configured');
    }

    let payload: AdminAccessJwtPayload;
    try {
      payload = this.jwtService.verify<AdminAccessJwtPayload>(token, {
        secret,
        algorithms: ['HS256'],
        issuer,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.tokenType !== 'admin_access') {
      throw new UnauthorizedException('Invalid admin token type');
    }
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid admin session');
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
    if (!session) {
      throw new UnauthorizedException('Admin session revoked or expired');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, accountStatus: true },
    });
    if (!admin || admin.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Admin account inactive');
    }
    if (admin.email !== payload.email) {
      throw new UnauthorizedException('Invalid admin token');
    }
    if (admin.role !== payload.role) {
      throw new UnauthorizedException('Admin role changed — please sign in again');
    }

    request.user = {
      id: admin.id,
      role: admin.role,
      email: admin.email,
      sessionId: session.id,
    };
    return true;
  }
}
