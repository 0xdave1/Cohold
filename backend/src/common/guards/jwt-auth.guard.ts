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

export interface JwtPayload {
  sub: string;
  role: string;
  /** Present on user access tokens after OTP verification (defense in depth). */
  ev?: boolean;
  tokenType?: 'access' | 'refresh';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
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
        this.logger.debug(`missing bearer token path=${String(request.originalUrl ?? request.url ?? '')}`);
      }
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    const secret = this.configService.get<string>('config.jwt.accessSecret');
    const issuer = this.configService.get<string>('config.jwt.issuer') ?? 'cohold-api';
    const audience = this.configService.get<string>('config.jwt.audience') ?? 'cohold-client';
    if (!secret) {
      throw new UnauthorizedException('JWT not configured');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret,
        algorithms: ['HS256'],
        issuer,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (payload.role === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, emailVerifiedAt: true, isFrozen: true },
      });
      if (!user || user.isFrozen) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      if (!user.emailVerifiedAt) {
        throw new UnauthorizedException({
          code: 'OTP_NOT_VERIFIED',
          message: 'Please verify your email with the OTP before logging in.',
        });
      }
    }

    request.user = {
      id: payload.sub,
      role: payload.role,
    };
    return true;
  }
}
