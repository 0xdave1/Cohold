import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('admin KYC review invalidation', () => {
  it('invalidates admin verification, user, and dashboard queries after approve/reject', () => {
    const src = readRel('lib/admin/use-admin-kyc-review.ts');
    expect(src).toContain('invalidateQueries');
    expect(src).toContain("['admin', 'verifications']");
    expect(src).toContain("['admin', 'users']");
    expect(src).toContain("['admin', 'dashboard']");
    expect(src).toContain("['admin', 'user']");
  });

  it('verifications page uses admin KYC review mutations', () => {
    const page = readRel('app/admin/(panel)/verifications/page.tsx');
    expect(page).toContain('useAdminApproveKyc');
    expect(page).toContain('useAdminRejectKyc');
  });
});
