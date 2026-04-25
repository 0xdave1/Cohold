import { WithdrawalThrottleGuard } from './withdrawal-throttle.guard';

describe('WithdrawalThrottleGuard', () => {
  it('keys throttling by authenticated user id', async () => {
    const guard = Object.create(WithdrawalThrottleGuard.prototype) as WithdrawalThrottleGuard;
    const tracker = await (guard as any).getTracker({ user: { id: 'user-123' }, ip: '127.0.0.1' });
    expect(tracker).toBe('withdrawal:user:user-123');
  });

  it('falls back to ip key when user is unavailable', async () => {
    const guard = Object.create(WithdrawalThrottleGuard.prototype) as WithdrawalThrottleGuard;
    const tracker = await (guard as any).getTracker({ ip: '127.0.0.1' });
    expect(tracker).toBe('withdrawal:ip:127.0.0.1');
  });
});
