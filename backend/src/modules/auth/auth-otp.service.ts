import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService, RedisUnavailableError } from '../redis/redis.service';

export type OtpPurpose = 'signup' | 'login' | 'reset' | 'transaction' | 'delete_account';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthOtpService {
  constructor(private readonly redis: RedisService) {}

  keyForEmail(purpose: Exclude<OtpPurpose, 'transaction'>, email: string): string {
    return `otp:${purpose}:${normalizeEmail(email)}`;
  }

  keyForTxn(userId: string): string {
    return `otp:txn:${userId}`;
  }

  async storeEmailOtp(purpose: Exclude<OtpPurpose, 'transaction'>, email: string, otp: string, ttlSeconds: number) {
    try {
      await this.redis.set(this.keyForEmail(purpose, email), { otp }, { ttlSeconds });
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async storeTxnOtp(userId: string, otp: string, ttlSeconds: number) {
    try {
      await this.redis.set(this.keyForTxn(userId), { otp }, { ttlSeconds });
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async readEmailOtp(purpose: Exclude<OtpPurpose, 'transaction'>, email: string): Promise<string | null> {
    try {
      const v = await this.redis.get<{ otp: string }>(this.keyForEmail(purpose, email));
      return v?.otp ?? null;
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async readTxnOtp(userId: string): Promise<string | null> {
    try {
      const v = await this.redis.get<{ otp: string }>(this.keyForTxn(userId));
      return v?.otp ?? null;
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async consumeEmailOtp(purpose: Exclude<OtpPurpose, 'transaction'>, email: string): Promise<void> {
    try {
      await this.redis.del(this.keyForEmail(purpose, email));
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }

  async consumeTxnOtp(userId: string): Promise<void> {
    try {
      await this.redis.del(this.keyForTxn(userId));
    } catch (e) {
      if (e instanceof RedisUnavailableError) {
        throw new ServiceUnavailableException('Verification service unavailable. Please try again later.');
      }
      throw e;
    }
  }
}

