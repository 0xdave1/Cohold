import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

describe('dashboard wallet card dedicated account', () => {
  it('home wires virtual account pill without Flutterwave copy', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).toContain('WalletBalanceCard');
    expect(home).toContain('useMyVirtualAccount');
    expect(home).toContain('resolveDedicatedAccountPillState');
    expect(home).toContain('DedicatedAccountPill');
    expect(home).toContain('handleDedicatedAccountPillClick');
    expect(home).toContain('AccountDetailsModal');
    expect(home).not.toMatch(/Flutterwave/i);
    expect(home).not.toMatch(/getVirtualAccountWalletNotice/);
  });

  it('does not render full account number on dashboard card sources', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    const card = readRel('components/wallet/WalletBalanceCard.tsx');
    const pill = readRel('components/wallet/DedicatedAccountPill.tsx');
    expect(home).not.toMatch(/virtualAccount\.data\.accountNumber\}/);
    expect(home).not.toMatch(/\{virtualAccountQuery\.data\.accountNumber\}/);
    expect(card).not.toContain('accountNumber');
    expect(pill).not.toContain('accountNumber');
    expect(pill).toContain('maskedLabel');
  });

  it('active pill opens account details from home handler', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).toMatch(/kind === 'active'[\s\S]*setShowAccountDetailsModal\(true\)/);
  });

  it('wallet balance uses server query without optimistic setQueryData on home', () => {
    const home = readRel('app/dashboard/home/page.tsx');
    expect(home).toContain('useWalletBalances');
    expect(home).not.toContain('setQueryData');
    expect(home).not.toContain('invalidateQueries');
  });

  it('DedicatedAccountPill component has Figma status copy', () => {
    const pill = readRel('components/wallet/DedicatedAccountPill.tsx');
    expect(pill).toContain('Account provisioning…');
    expect(pill).toContain('Account setup needs retry');
    expect(pill).toContain('Complete KYC to get your account');
    expect(pill).toContain('Account unavailable');
    expect(pill).toContain('#054870');
    expect(pill).toContain('#DDD8D2');
  });
});
