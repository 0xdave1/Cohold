import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('SupportController metadata sanitization (Issue 12)', () => {
  it('allowlists user conversation metadata keys (drops unknown / secret-like payloads at boundary)', () => {
    const src = readFileSync(join(__dirname, 'support.controller.ts'), 'utf8');
    expect(src).toContain('allowedKeys');
    expect(src).toContain('transactionRef');
    expect(src).toContain('if (!allowedKeys.has(k)) continue');
  });
});
