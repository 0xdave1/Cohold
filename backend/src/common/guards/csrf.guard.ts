import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  private static readonly EXEMPT_PATH_PREFIXES = [
    '/api/v1/auth/login',
    '/api/v1/auth/signup',
    '/api/v1/auth/complete-signup',
    '/api/v1/auth/request-otp',
    '/api/v1/auth/verify-otp',
    '/api/v1/auth/reset-password',
    /** Uses HttpOnly refresh cookie; no readable CSRF on cold load before first session. */
    '/api/v1/auth/refresh',
    '/api/v1/webhook',
  ];

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method ?? '').toUpperCase();
    if (CsrfGuard.SAFE_METHODS.has(method)) {
      return true;
    }

    const path = String(req.originalUrl ?? req.url ?? '');
    if (CsrfGuard.EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    const csrfCookie = req.cookies?.cohold_csrf_token;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new BadRequestException('CSRF token mismatch');
    }

    return true;
  }
}

