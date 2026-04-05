import {
  CanActivate,
  ExecutionContext,
  Injectable,
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
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization');
    }

    const token = authHeader.slice(7);
    const secret = this.configService.get<string>('config.jwt.accessSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT not configured');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
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
