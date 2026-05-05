import { HttpException } from '@nestjs/common';
import { AuthAttemptsService } from './auth-attempts.service';
import { RedisService } from '../redis/redis.service';

describe('AuthAttemptsService', () => {
  let service: AuthAttemptsService;
  const redis = {
    get: jest.fn(),
    increment: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthAttemptsService(redis as unknown as RedisService);
  });

  it('locks after max OTP verify failures within window', async () => {
    redis.get.mockResolvedValue(null);
    let n = 0;
    redis.increment.mockImplementation(async () => {
      n += 1;
      return n;
    });
    for (let i = 0; i < 5; i++) {
      await service.recordOtpVerifyFailure('reset', 'a@b.co');
    }
    expect(redis.set).toHaveBeenCalled();
  });

  it('assertNotLocked throws 429 when lock key present', async () => {
    redis.get.mockResolvedValue({ until: new Date(Date.now() + 60_000).toISOString() });
    await expect(service.assertEmailNotLockedForOtpVerify('reset', 'a@b.co')).rejects.toBeInstanceOf(HttpException);
  });

  it('assertEmailNotLockedForOtpRequest passes when no lock', async () => {
    redis.get.mockResolvedValue(null);
    await expect(service.assertEmailNotLockedForOtpRequest('signup', 'a@b.co')).resolves.toBeUndefined();
  });
});
