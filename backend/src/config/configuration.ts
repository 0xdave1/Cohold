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
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
    baseUrl: process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co',
  },
  /** Public app URL for Paystack redirect after card payment (e.g. http://localhost:3001) */
  frontendUrl: process.env.FRONTEND_URL ?? 'http://cohold.vercel.app',
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

