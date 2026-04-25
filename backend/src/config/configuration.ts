import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE,
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  redis: { url: process.env.REDIS_URL },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'cohold-api',
    audience: process.env.JWT_AUDIENCE ?? 'cohold-client',
    sessionPepper: process.env.AUTH_SESSION_PEPPER ?? process.env.JWT_REFRESH_SECRET,
    maxSessionLifetimeDays: parseInt(process.env.AUTH_MAX_SESSION_LIFETIME_DAYS ?? '30', 10),
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
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  s3: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
  },
  email: {
    apiKey: process.env.EMAIL_API_KEY,
    from: process.env.EMAIL_FROM,
  },
  fx: {
    apiKey: process.env.EXCHANGE_RATE_API_KEY,
  },
}));

