import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isKycMoneyActionAllowed, normalizeKycStatus } from '@/lib/kyc/status';
import { maskSensitiveId } from '@/lib/kyc/identity';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 5 frontend KYC compliance hardening', () => {
  it('renders submitted as under review (not verified)', () => {
    expect(normalizeKycStatus('SUBMITTED')).toBe('PENDING_REVIEW');
    expect(isKycMoneyActionAllowed('SUBMITTED')).toBe(false);
  });

  it('manual review is never treated as verified', () => {
    expect(normalizeKycStatus('MANUAL_REVIEW')).toBe('MANUAL_REVIEW');
    expect(isKycMoneyActionAllowed('MANUAL_REVIEW')).toBe(false);
  });

  it('rejected and unknown statuses block money actions', () => {
    expect(isKycMoneyActionAllowed('REJECTED')).toBe(false);
    expect(isKycMoneyActionAllowed('UNKNOWN')).toBe(false);
  });

  it('defensively masks accidental raw identity values', () => {
    expect(maskSensitiveId('12345678901')).toBe('*******8901');
  });

  it('KYC frontend does not store identity fields in local/session storage', () => {
    const src = readRel('app/dashboard/kyc/page.tsx');
    expect(src).not.toContain('localStorage');
    expect(src).not.toContain('sessionStorage');
  });

  it('KYC modules do not log sensitive payloads', () => {
    const kycPage = readRel('app/dashboard/kyc/page.tsx');
    const kycHook = readRel('lib/hooks/use-kyc.ts');
    expect(kycPage).not.toContain('console.log');
    expect(kycHook).not.toContain('console.log');
  });

  it('upload completion payload is derived from backend-provided key', () => {
    const upload = readRel('lib/uploads/upload-file.ts');
    expect(upload).toContain('const { key, uploadUrl } = presign.data;');
    expect(upload).toContain('opts.buildCompleteBody(key)');
  });

  it('admin KYC document access uses backend signed-read endpoint', () => {
    const adminUserDetail = readRel('app/admin/(panel)/users/[id]/page.tsx');
    expect(adminUserDetail).toContain('adminApi.getKycSignedReadUrl');
    expect(adminUserDetail).not.toContain('https://');
  });
});
