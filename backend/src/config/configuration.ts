import { registerAs } from '@nestjs/config';

export default registerAs('config', () => {
  const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const adminAllowedOrigins = (process.env.ADMIN_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveCorsAllowedOrigins = [...new Set([...corsAllowedOrigins, ...adminAllowedOrigins])];

  return {
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    corsAllowedOrigins,
    adminAllowedOrigins,
    effectiveCorsAllowedOrigins,
    corsCredentials: (process.env.CORS_CREDENTIALS ?? 'true') === 'true',
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
    enableSwagger: (process.env.ENABLE_SWAGGER ?? 'false') === 'true',
    swaggerUsername: process.env.SWAGGER_USERNAME,
    swaggerPassword: process.env.SWAGGER_PASSWORD,
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN ?? undefined,
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE,
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  redis: { url: process.env.REDIS_URL },
  outbox: {
    workerEnabled: (process.env.OUTBOX_WORKER_ENABLED ?? 'false') === 'true',
    batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? '25', 10),
    maxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS ?? '5', 10),
    baseDelaySeconds: parseInt(process.env.OUTBOX_BASE_DELAY_SECONDS ?? '30', 10),
    deadLetterAlertThreshold: parseInt(process.env.OUTBOX_DEAD_LETTER_ALERT_THRESHOLD ?? '25', 10),
    emailDeliveryEnabled: (process.env.EMAIL_DELIVERY_ENABLED ?? 'true') === 'true',
    websocketDeliveryEnabled: (process.env.WEBSOCKET_DELIVERY_ENABLED ?? 'true') === 'true',
  },
  security: {
    rateLimitTtlMs: parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
    rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '100', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'cohold-api',
    audience: process.env.JWT_AUDIENCE ?? 'cohold-client',
    sessionPepper: process.env.AUTH_SESSION_PEPPER ?? process.env.JWT_REFRESH_SECRET,
    maxSessionLifetimeDays: parseInt(process.env.AUTH_MAX_SESSION_LIFETIME_DAYS ?? '30', 10),
    /** Isolated from end-user JWTs (Issue 4). In production must be set explicitly — see validation. */
    adminAccessSecret:
      process.env.JWT_ADMIN_ACCESS_SECRET ??
      (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
        ? undefined
        : `${process.env.JWT_ACCESS_SECRET ?? ''}.cohold-admin-access-dev-only`),
    adminRefreshSecret:
      process.env.JWT_ADMIN_REFRESH_SECRET ??
      (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
        ? undefined
        : `${process.env.JWT_REFRESH_SECRET ?? ''}.cohold-admin-refresh-dev-only`),
    adminIssuer: process.env.JWT_ADMIN_ISSUER ?? process.env.JWT_ISSUER ?? 'cohold-api',
    adminAudience: process.env.JWT_ADMIN_AUDIENCE ?? 'cohold-admin-panel',
    adminAccessExpiresIn: process.env.JWT_ADMIN_ACCESS_EXPIRES_IN ?? process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    adminRefreshExpiresIn: process.env.JWT_ADMIN_REFRESH_EXPIRES_IN ?? process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  kyc: {
    encryptionKey: process.env.KYC_ENCRYPTION_KEY,
    hashSecret: process.env.KYC_HASH_SECRET,
    identityProviderMode: (process.env.KYC_IDENTITY_PROVIDER_MODE ?? 'manual').toLowerCase(),
    autoVerificationRequired: process.env.KYC_AUTO_VERIFICATION_REQUIRED === 'true',
    maxDocumentBytes: parseInt(process.env.KYC_MAX_DOCUMENT_BYTES ?? `${5 * 1024 * 1024}`, 10),
  },
  flutterwave: {
    secretKey: process.env.FLW_SECRET_KEY ?? process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLW_PUBLIC_KEY ?? process.env.FLUTTERWAVE_PUBLIC_KEY,
    webhookSecret: process.env.FLW_WEBHOOK_SECRET ?? process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    baseUrl:
      process.env.FLW_BASE_URL ??
      process.env.FLUTTERWAVE_BASE_URL ??
      'https://api.flutterwave.com/v3',
  },
  virtualAccounts: {
    enabled: process.env.VIRTUAL_ACCOUNTS_ENABLED === 'true',
    flutterwaveEnabled:
      (process.env.FLUTTERWAVE_VIRTUAL_ACCOUNT_ENABLED ?? process.env.VIRTUAL_ACCOUNTS_ENABLED) ===
      'true',
  },
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
  },
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  },
  fx: {
    apiKey: process.env.EXCHANGE_RATE_API_KEY,
  },
  };
});
