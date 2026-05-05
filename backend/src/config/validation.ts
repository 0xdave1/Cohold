import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),
  FRONTEND_URL: Joi.string().uri().optional(),
  CORS_ORIGIN: Joi.string().optional(),
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

  FLW_SECRET_KEY: Joi.string().optional(),
  FLW_PUBLIC_KEY: Joi.string().optional(),
  FLW_WEBHOOK_SECRET: Joi.string().optional(),
  FLW_BASE_URL: Joi.string().uri().optional(),
  FLUTTERWAVE_SECRET_KEY: Joi.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: Joi.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: Joi.string().optional(),
  FLUTTERWAVE_BASE_URL: Joi.string().uri().optional(),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),

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
  .or('FLW_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY')
  .or('FLW_PUBLIC_KEY', 'FLUTTERWAVE_PUBLIC_KEY')
  .or('FLW_WEBHOOK_SECRET', 'FLUTTERWAVE_WEBHOOK_SECRET')
  .custom((value, helpers) => {
    const nodeEnv = value.NODE_ENV as string;
    const prodLike = nodeEnv === 'production' || nodeEnv === 'staging';
    const userAccess = value.JWT_ACCESS_SECRET as string;
    const userRefresh = value.JWT_REFRESH_SECRET as string;
    const adminAccess = (value.JWT_ADMIN_ACCESS_SECRET as string | undefined) ?? `${userAccess}.cohold-admin-access-dev-only`;
    const adminRefresh =
      (value.JWT_ADMIN_REFRESH_SECRET as string | undefined) ?? `${userRefresh}.cohold-admin-refresh-dev-only`;

    if (prodLike) {
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
