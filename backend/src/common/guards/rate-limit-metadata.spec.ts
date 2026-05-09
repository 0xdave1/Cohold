import 'reflect-metadata';
import { AuthController } from '../../modules/auth/auth.controller';
import { AdminAuthController } from '../../modules/admin-auth/admin-auth.controller';
import { WithdrawalController } from '../../modules/withdrawal/withdrawal.controller';

function hasThrottleMetadata(target: object, methodName: string): boolean {
  const method = (target as any)[methodName];
  const keys = Reflect.getMetadataKeys(method);
  return keys.some((k) => String(k).toLowerCase().includes('throttler'));
}

describe('security throttle metadata', () => {
  it('auth login and otp endpoints are throttled', () => {
    expect(hasThrottleMetadata(AuthController.prototype, 'login')).toBe(true);
    expect(hasThrottleMetadata(AuthController.prototype, 'verifyOtp')).toBe(true);
  });

  it('admin login endpoint is throttled', () => {
    expect(hasThrottleMetadata(AdminAuthController.prototype, 'login')).toBe(true);
  });

  it('withdrawal create endpoint is throttled', () => {
    expect(hasThrottleMetadata(WithdrawalController.prototype, 'create')).toBe(true);
  });
});

