import { COHOLD_WS_CORS_ORIGINS, wsCorsOptions } from './ws-cors-origins';

describe('COHOLD_WS_CORS_ORIGINS', () => {
  it('never uses wildcard with credentials', () => {
    expect(COHOLD_WS_CORS_ORIGINS).not.toContain('*');
    expect(COHOLD_WS_CORS_ORIGINS.length).toBeGreaterThan(0);
    const opts = wsCorsOptions();
    expect(opts.credentials).toBe(true);
    expect(opts.origin).not.toContain('*' as never);
  });
});
