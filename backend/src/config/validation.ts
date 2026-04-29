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
})
  .or('FLW_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY')
  .or('FLW_PUBLIC_KEY', 'FLUTTERWAVE_PUBLIC_KEY')
  .or('FLW_WEBHOOK_SECRET', 'FLUTTERWAVE_WEBHOOK_SECRET');

