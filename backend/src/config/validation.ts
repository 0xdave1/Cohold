import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),

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

  FLW_SECRET_KEY: Joi.string().required(),
  FLW_PUBLIC_KEY: Joi.string().required(),
  FLW_WEBHOOK_SECRET: Joi.string().required(),
  FLW_BASE_URL: Joi.string().uri().default('https://api.flutterwave.com/v3'),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),

  S3_ACCESS_KEY_ID: Joi.string().required(),
  S3_SECRET_ACCESS_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().required(),
  S3_ENDPOINT: Joi.string().uri().required(),
  

  EMAIL_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  ELASTICSEARCH_NODE: Joi.string().uri().optional(),
});

