import { HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RedisService, RedisUnavailableError } from '../redis/redis.service';

type AttemptScope =
  | 'login'
  | 'otp-verify'
  | 'otp-request'
  | 'password-reset'
  | 'txn-otp-verify';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthAttemptsService {
  constructor(private readonly redis: RedisService) {}

  private key(scope: AttemptScope, id: string): string {
    return `attempt:${scope}:${id}`;
  }

  private lockKey(scope: AttemptScope, id: string): string {
    return `lock:${scope}:${id}`;
  }

  async assertNotLocked(scope: AttemptScope, id: string): Promise<void> {
    const key = this.lockKey(scope, id);
    try {
      const locked = await this.redis.get<{ until: string }>(key);
      if (locked) {
        throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        // For auth/OTP, we fail closed in production-like environments.
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  /**
   * Increments attempt counter with TTL and optionally locks the user out.
   * Returns the new count.
   */
  async recordAttempt(opts: {
    scope: AttemptScope;
    id: string;
    windowSeconds: number;
    maxAttempts: number;
    lockSeconds: number;
  }): Promise<number> {
    const { scope, id, windowSeconds, maxAttempts, lockSeconds } = opts;
    try {
      const count = await this.redis.increment(this.key(scope, id), 1, windowSeconds);
      if (count >= maxAttempts) {
        await this.redis.set(this.lockKey(scope, id), { until: new Date(Date.now() + lockSeconds * 1000).toISOString() }, { ttlSeconds: lockSeconds });
      }
      return count;
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async reset(scope: AttemptScope, id: string): Promise<void> {
    try {
      await Promise.all([this.redis.del(this.key(scope, id)), this.redis.del(this.lockKey(scope, id))]);
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        // If Redis is down, do not silently “reset”; treat as unavailable.
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  /**
   * Helpers for common flows.
   */
  async assertEmailNotLockedForLogin(email: string) {
    return this.assertNotLocked('login', normalizeEmail(email));
  }
  async recordLoginFailure(email: string) {
    return this.recordAttempt({
      scope: 'login',
      id: normalizeEmail(email),
      windowSeconds: 15 * 60,
      maxAttempts: 8,
      lockSeconds: 15 * 60,
    });
  }

  async assertEmailNotLockedForOtpVerify(purpose: string, email: string) {
    return this.assertNotLocked('otp-verify', `${purpose}:${normalizeEmail(email)}`);
  }
  async recordOtpVerifyFailure(purpose: string, email: string) {
    return this.recordAttempt({
      scope: 'otp-verify',
      id: `${purpose}:${normalizeEmail(email)}`,
      windowSeconds: 10 * 60,
      maxAttempts: 5,
      lockSeconds: 10 * 60,
    });
  }

  async assertEmailNotLockedForOtpRequest(purpose: string, email: string) {
    return this.assertNotLocked('otp-request', `${purpose}:${normalizeEmail(email)}`);
  }
  async recordOtpRequest(purpose: string, email: string) {
    // Prevent OTP spamming: 3 per 10 minutes per purpose+email.
    return this.recordAttempt({
      scope: 'otp-request',
      id: `${purpose}:${normalizeEmail(email)}`,
      windowSeconds: 10 * 60,
      maxAttempts: 3,
      lockSeconds: 10 * 60,
    });
  }

  async assertNotLockedTxnOtpVerify(userId: string) {
    return this.assertNotLocked('txn-otp-verify', userId);
  }
  async recordTxnOtpVerifyFailure(userId: string) {
    return this.recordAttempt({
      scope: 'txn-otp-verify',
      id: userId,
      windowSeconds: 10 * 60,
      maxAttempts: 5,
      lockSeconds: 10 * 60,
    });
  }

  static invalidOtp(): UnauthorizedException {
    return new UnauthorizedException('Invalid or expired OTP');
  }
}

