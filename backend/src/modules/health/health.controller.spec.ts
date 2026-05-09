import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns safe liveness shape', () => {
    const controller = new HealthController({} as any, {} as any, { backlogSummary: jest.fn() } as any);
    expect(controller.live()).toEqual({ ok: true, status: 'live' });
  });

  it('returns safe readiness shape without leaking internals', async () => {
    const controller = new HealthController(
      { $queryRaw: jest.fn().mockResolvedValue([1]) } as any,
      { isEnabled: () => false, raw: () => ({ ping: jest.fn() }) } as any,
      { backlogSummary: jest.fn().mockResolvedValue({ pending: 0, processing: 0, deadLetter: 0 }) } as any,
    );
    const out = await controller.ready();
    expect(out).toEqual({
      ok: true,
      status: 'ready',
      checks: { db: 'up', redis: 'up', outbox: 'up' },
      outbox: { pending: 0, processing: 0, deadLetter: 0 },
    });
    expect(JSON.stringify(out)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(out)).not.toContain('secret');
  });
});

