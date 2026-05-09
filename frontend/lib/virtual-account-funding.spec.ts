import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('Issue 6 virtual account funding frontend', () => {
  it('wallet page renders ACTIVE details from backend virtual account data only', () => {
    const src = readRel('app/dashboard/wallet/page.tsx');
    expect(src).toContain("virtualAccount.data?.status === 'ACTIVE'");
    expect(src).toContain('virtualAccount.data.accountNumber');
    expect(src).not.toContain('Math.random()');
    expect(src).not.toContain('generateAccount');
  });

  it('wallet page handles pending/failed/retry states honestly', () => {
    const src = readRel('app/dashboard/wallet/page.tsx');
    expect(src).toContain("virtualAccount.data?.status === 'PENDING'");
    expect(src).toContain("virtualAccount.data?.status === 'REQUIRES_RETRY'");
    expect(src).toContain("virtualAccount.data?.status === 'FAILED'");
    expect(src).toContain('Retry provisioning');
  });

  it('wallet page gates virtual account details behind VERIFIED KYC', () => {
    const src = readRel('app/dashboard/wallet/page.tsx');
    expect(src).toContain("kyc?.status === 'VERIFIED'");
    expect(src).toContain('Complete KYC');
  });

  it('bank transfer section does not optimistically mutate wallet balance', () => {
    const src = readRel('app/dashboard/wallet/page.tsx');
    expect(src).not.toContain('setQueryData');
    expect(src).not.toContain('optimistic');
    expect(src).toContain('your balance updates');
  });

  it('flutterwave funding path remains initialize endpoint', () => {
    const src = readRel('lib/hooks/use-wallet.ts');
    expect(src).toContain('FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH');
    expect(src).not.toContain('/wallets/top-up');
  });

  it('top-up page supports both bank transfer and flutterwave rails', () => {
    const src = readRel('app/dashboard/wallets/top-up/page.tsx');
    expect(src).toContain('Bank transfer (virtual account)');
    expect(src).toContain('Flutterwave checkout');
  });

  it('admin API exposes virtual account failure/retry endpoints', () => {
    const src = readRel('lib/admin/api.ts');
    expect(src).toContain('admin/virtual-accounts/failed');
    expect(src).toContain('admin/users/${userId}/virtual-account/retry');
  });

  it('admin virtual account page does not render provider raw response', () => {
    const src = readRel('app/admin/(panel)/virtual-accounts/page.tsx');
    expect(src).not.toContain('lastProviderResponse');
    expect(src).not.toContain('payload');
  });
});
