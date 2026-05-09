import { ConfigService } from '@nestjs/config';

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function parseOrigins(csv: string): string[] {
  return String(csv ?? '')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0);
}

export function shouldEnableSwagger(env: string, enableSwagger: boolean): boolean {
  if (env !== 'production') return true;
  return enableSwagger;
}

export function buildCorsOriginValidator(
  allowedOrigins: string[],
): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const allowed = new Set<string>(allowedOrigins.map(normalizeOrigin));

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowed.has(normalizeOrigin(origin)));
  };
}

export function assertProductionSecurityConfig(configService: ConfigService): void {
  const env = String(configService.get<string>('config.app.env') ?? process.env.NODE_ENV ?? 'development');
  const corsCredentials = Boolean(configService.get<boolean>('config.app.corsCredentials'));
  const origins = configService.get<string[]>('config.app.effectiveCorsAllowedOrigins') ?? [];
  if ((env === 'production' || env === 'staging') && corsCredentials) {
    if (origins.length === 0 || origins.some((o) => o === '*')) {
      throw new Error('Unsafe CORS config: credentials-enabled CORS requires explicit allowlisted origins.');
    }
  }
}
