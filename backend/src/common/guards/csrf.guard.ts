import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  /** Exact auth entrypoints only — do not use `/api/v1/auth` (would exempt protected mutations). */
  private static readonly EXEMPT_PATH_PREFIXES = [
    '/api/v1/auth/login',
    '/api/v1/auth/signup',
    '/api/v1/auth/complete-signup',
    '/api/v1/auth/request-otp',
    '/api/v1/auth/resend-otp',
    '/api/v1/auth/verify-otp',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/admin-auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/admin-auth/refresh',
  ];

  /** Signature-verified Flutterwave webhook only (not all `/webhooks/*`). */
  private static isFlutterwaveWebhookPath(path: string): boolean {
    return path === '/api/v1/webhooks/flutterwave' || path.startsWith('/api/v1/webhooks/flutterwave?');
  }

  private static isExemptPath(path: string): boolean {
    if (CsrfGuard.EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return true;
    }
    return CsrfGuard.isFlutterwaveWebhookPath(path);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method ?? '').toUpperCase();
    if (CsrfGuard.SAFE_METHODS.has(method)) {
      return true;
    }

    const path = String(req.originalUrl ?? req.url ?? '');
    if (CsrfGuard.isExemptPath(path)) {
      return true;
    }

    const authz = req.headers?.authorization;
    if (typeof authz === 'string' && authz.trim().toLowerCase().startsWith('bearer ')) {
      return true;
    }

    const csrfCookie = req.cookies?.cohold_csrf_token;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      if (process.env.AUTH_DEBUG === '1') {
        this.logger.debug(
          `csrf mismatch path=${path} method=${method} cookie=${Boolean(csrfCookie)} header=${Boolean(csrfHeader)}`,
        );
      }
      throw new BadRequestException('CSRF token mismatch');
    }

    return true;
  }
}
