import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),
  FRONTEND_URL: Joi.string().uri().optional(),
  CORS_ORIGIN: Joi.string().optional(),
  CORS_ALLOWED_ORIGINS: Joi.string().optional(),
  ADMIN_ALLOWED_ORIGINS: Joi.string().optional(),
  CORS_CREDENTIALS: Joi.string().valid('true', 'false').default('true'),
  BODY_LIMIT: Joi.string().default('1mb'),
  ENABLE_SWAGGER: Joi.string().valid('true', 'false').default('false'),
  SWAGGER_USERNAME: Joi.string().optional(),
  SWAGGER_PASSWORD: Joi.string().optional(),
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  RATE_LIMIT_LIMIT: Joi.number().integer().min(1).default(100),
  OUTBOX_WORKER_ENABLED: Joi.string().valid('true', 'false').default('false'),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(25),
  OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  OUTBOX_BASE_DELAY_SECONDS: Joi.number().integer().min(1).max(3600).default(30),
  OUTBOX_DEAD_LETTER_ALERT_THRESHOLD: Joi.number().integer().min(1).default(25),
  EMAIL_DELIVERY_ENABLED: Joi.string().valid('true', 'false').default('true'),
  WEBSOCKET_DELIVERY_ENABLED: Joi.string().valid('true', 'false').default('true'),
  AUTH_COOKIE_DOMAIN: Joi.string().optional(),

  DATABASE_URL: Joi.string().uri().required(),

  // Redis powers OTP, attempt lockouts, safe caching, and queues (ephemeral state only).
  // Postgres remains the source of truth for money, ledger, and ownership state.
  REDIS_URL: Joi.string()
    .uri()
    .when('NODE_ENV', {
      is: Joi.valid('production', 'staging'),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('cohold-api'),
  JWT_AUDIENCE: Joi.string().default('cohold-client'),

  /** Issue 4 — must be explicit in production/staging; optional in dev/test (configuration derives dev-only fallbacks). */
  JWT_ADMIN_ACCESS_SECRET: Joi.string().min(32).optional(),
  JWT_ADMIN_REFRESH_SECRET: Joi.string().min(32).optional(),
  JWT_ADMIN_ISSUER: Joi.string().default('cohold-api'),
  JWT_ADMIN_AUDIENCE: Joi.string().default('cohold-admin-panel'),
  JWT_ADMIN_ACCESS_EXPIRES_IN: Joi.string().optional(),
  JWT_ADMIN_REFRESH_EXPIRES_IN: Joi.string().optional(),

  AUTH_SESSION_PEPPER: Joi.string().min(16).optional(),
  AUTH_MAX_SESSION_LIFETIME_DAYS: Joi.number().integer().min(1).max(365).default(30),

  PAYSTACK_SECRET_KEY: Joi.string().optional(),
  PAYSTACK_PUBLIC_KEY: Joi.string().optional(),
  PAYSTACK_CALLBACK_URL: Joi.string().uri().optional(),
  PAYSTACK_DVA_PREFERRED_BANK: Joi.string().optional(),
  PAYSTACK_TRANSFERS_ENABLED: Joi.string().valid('true', 'false').default('false'),
  PAYSTACK_ENV: Joi.string().valid('test', 'live').default('test'),
  PAYSTACK_VIRTUAL_ACCOUNT_ENABLED: Joi.string().valid('true', 'false').optional(),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  VIRTUAL_ACCOUNTS_ENABLED: Joi.string().valid('true', 'false').default('false'),

  S3_ACCESS_KEY_ID: Joi.string().required(),
  S3_SECRET_ACCESS_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().required(),
  S3_ENDPOINT: Joi.string().uri().required(),

  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  ELASTICSEARCH_NODE: Joi.string().uri().optional(),

  /** Issue 5 — required in production/staging (enforced in Joi.custom + KycIdentityCryptoService). */
  KYC_ENCRYPTION_KEY: Joi.string().optional(),
  KYC_HASH_SECRET: Joi.string().min(32).optional(),
  KYC_IDENTITY_PROVIDER_MODE: Joi.string().valid('manual', 'stub').default('manual'),
  KYC_AUTO_VERIFICATION_REQUIRED: Joi.string().valid('true', 'false').default('false'),
  KYC_MAX_DOCUMENT_BYTES: Joi.number().integer().min(1024).max(50_000_000).optional(),
})
  .custom((value, helpers) => {
    const nodeEnv = value.NODE_ENV as string;
    const prodLike = nodeEnv === 'production' || nodeEnv === 'staging';
    const userAccess = value.JWT_ACCESS_SECRET as string;
    const userRefresh = value.JWT_REFRESH_SECRET as string;
    const adminAccess = (value.JWT_ADMIN_ACCESS_SECRET as string | undefined) ?? `${userAccess}.cohold-admin-access-dev-only`;
    const adminRefresh =
      (value.JWT_ADMIN_REFRESH_SECRET as string | undefined) ?? `${userRefresh}.cohold-admin-refresh-dev-only`;

    if (prodLike) {
      const credentials = (value.CORS_CREDENTIALS ?? 'true') === 'true';
      const userOrigins = String(value.CORS_ALLOWED_ORIGINS ?? value.CORS_ORIGIN ?? value.FRONTEND_URL ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const adminOrigins = String(value.ADMIN_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const allowedOrigins = [...new Set([...userOrigins, ...adminOrigins])];
      if (credentials && (allowedOrigins.length === 0 || allowedOrigins.some((o: string) => o === '*'))) {
        return helpers.error('any.custom', {
          message: 'CORS_ALLOWED_ORIGINS must be explicit and non-wildcard when CORS_CREDENTIALS=true.',
        });
      }
      const enableSwagger = (value.ENABLE_SWAGGER ?? 'false') === 'true';
      if (enableSwagger && (!value.SWAGGER_USERNAME || !value.SWAGGER_PASSWORD)) {
        return helpers.error('any.custom', {
          message: 'SWAGGER_USERNAME and SWAGGER_PASSWORD are required when ENABLE_SWAGGER=true in production/staging.',
        });
      }
      if (!value.JWT_ADMIN_ACCESS_SECRET || !value.JWT_ADMIN_REFRESH_SECRET) {
        return helpers.error('any.custom', {
          message:
            'JWT_ADMIN_ACCESS_SECRET and JWT_ADMIN_REFRESH_SECRET are required in production/staging (Issue 4).',
        });
      }
      if (!value.KYC_ENCRYPTION_KEY || !value.KYC_HASH_SECRET) {
        return helpers.error('any.custom', {
          message: 'KYC_ENCRYPTION_KEY and KYC_HASH_SECRET are required in production/staging (Issue 5).',
        });
      }
      if (!value.PAYSTACK_SECRET_KEY) {
        return helpers.error('any.custom', {
          message: 'PAYSTACK_SECRET_KEY is required in production/staging.',
        });
      }
      const transfersEnabled = value.PAYSTACK_TRANSFERS_ENABLED === 'true';
      if (transfersEnabled && !value.PAYSTACK_SECRET_KEY) {
        return helpers.error('any.custom', {
          message: 'PAYSTACK_TRANSFERS_ENABLED requires PAYSTACK_SECRET_KEY.',
        });
      }
      const vaEnabled = value.VIRTUAL_ACCOUNTS_ENABLED === 'true';
      const paystackVaEnabled =
        (value.PAYSTACK_VIRTUAL_ACCOUNT_ENABLED ?? value.VIRTUAL_ACCOUNTS_ENABLED) === 'true';
      if (vaEnabled && paystackVaEnabled && !value.PAYSTACK_SECRET_KEY) {
        return helpers.error('any.custom', {
          message: 'Virtual accounts are enabled but PAYSTACK_SECRET_KEY is missing.',
        });
      }
    }

    if (adminAccess === userAccess || adminRefresh === userRefresh) {
      return helpers.error('any.custom', {
        message: 'Admin JWT secrets must differ from user JWT secrets.',
      });
    }
    if (adminAccess === adminRefresh) {
      return helpers.error('any.custom', {
        message: 'JWT_ADMIN_ACCESS_SECRET and JWT_ADMIN_REFRESH_SECRET must differ.',
      });
    }

    return value;
  });
