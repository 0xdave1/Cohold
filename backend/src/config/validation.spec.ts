import { validationSchema } from './validation';

const baseEnv = {
  NODE_ENV: 'production',
  PORT: 4000,
  API_PREFIX: '/api/v1',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/cohold',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  JWT_REFRESH_SECRET: 'y'.repeat(40),
  JWT_ADMIN_ACCESS_SECRET: 'a'.repeat(40),
  JWT_ADMIN_REFRESH_SECRET: 'b'.repeat(40),
  KYC_ENCRYPTION_KEY: 'k'.repeat(40),
  KYC_HASH_SECRET: 'h'.repeat(40),
  FLW_SECRET_KEY: 'flw-secret',
  FLW_PUBLIC_KEY: 'flw-pub',
  FLW_WEBHOOK_SECRET: 'flw-hook',
  S3_ACCESS_KEY_ID: 'ak',
  S3_SECRET_ACCESS_KEY: 'sk',
  S3_BUCKET: 'bucket',
  S3_REGION: 'auto',
  S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  RESEND_API_KEY: 're_key',
  EMAIL_FROM: 'noreply@example.com',
  CORS_CREDENTIALS: 'true',
  CORS_ALLOWED_ORIGINS: 'https://app.cohold.co',
  ENABLE_SWAGGER: 'false',
};

describe('env validation security rules', () => {
  it('fails when production CORS credentials are wildcard', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: '*',
    });
    expect(error).toBeTruthy();
  });

  it('fails when swagger enabled in production without docs credentials', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      ENABLE_SWAGGER: 'true',
      SWAGGER_USERNAME: '',
      SWAGGER_PASSWORD: '',
    });
    expect(error).toBeTruthy();
  });
});

