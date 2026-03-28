import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),

  DATABASE_URL: Joi.string().uri().required(),

  // Redis temporarily disabled – can be re-enabled later
  // REDIS_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().optional(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  PAYSTACK_SECRET_KEY: Joi.string().required(),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().required(),
  PAYSTACK_BASE_URL: Joi.string().uri().default('https://api.paystack.co'),
  FRONTEND_URL: Joi.string().uri().default('http://cohold.vercel.app'),

  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().required(),
  S3_ENDPOINT: Joi.string().uri().required(),

  EMAIL_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  ELASTICSEARCH_NODE: Joi.string().uri().optional(),
});

