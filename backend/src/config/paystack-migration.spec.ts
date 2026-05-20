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
  PAYSTACK_SECRET_KEY: 'sk_test_xxx',
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

describe('Paystack env validation', () => {
  it('does not require Flutterwave env vars', () => {
    const { error, value } = validationSchema.validate(baseEnv);
    expect(error).toBeFalsy();
    expect(value.PAYSTACK_SECRET_KEY).toBeTruthy();
    expect((value as Record<string, unknown>).FLW_SECRET_KEY).toBeUndefined();
  });

  it('requires PAYSTACK_SECRET_KEY in production', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      PAYSTACK_SECRET_KEY: undefined,
    });
    expect(error).toBeTruthy();
    const msg = JSON.stringify(error);
    expect(msg).toMatch(/PAYSTACK_SECRET_KEY/i);
  });
});
