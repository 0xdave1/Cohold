import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class WithdrawalThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req?.user?.id ?? req?.user?.sub;
    if (typeof userId === 'string' && userId.length > 0) {
      return `withdrawal:user:${userId}`;
    }
    const ip = req?.ip ?? 'unknown';
    return `withdrawal:ip:${ip}`;
  }
}
