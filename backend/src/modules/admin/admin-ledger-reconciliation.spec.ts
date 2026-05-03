import * as fs from 'fs';
import * as path from 'path';

describe('Admin ledger reconciliation (Issue 3)', () => {
  it('GET ledger/reconciliation route is declared with SUPER_ADMIN role', () => {
    const file = fs.readFileSync(path.join(__dirname, 'admin.controller.ts'), 'utf8');
    const i = file.indexOf('ledgerReconciliation');
    expect(i).toBeGreaterThan(-1);
    const window = file.slice(Math.max(0, i - 200), i);
    expect(window).toContain('SUPER_ADMIN');
    expect(window).toContain('@Roles');
  });
});
