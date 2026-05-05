import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deprecated Next admin auth proxy routes', () => {
  it('login and logout route handlers are removed', () => {
    const base = join(process.cwd(), 'app', 'api', 'admin', 'auth');
    expect(existsSync(join(base, 'login', 'route.ts'))).toBe(false);
    expect(existsSync(join(base, 'logout', 'route.ts'))).toBe(false);
  });
});
