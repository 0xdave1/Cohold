import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH } from '@/lib/constants/wallet-funding';

const readRel = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8');

/** Assembled at runtime so app sources stay free of this unsafe historical route string. */
const forbiddenSelfCreditWalletPost = ['', 'wallets', 'top-up'].join('/');

describe('Issue 1 — wallet funding security (frontend)', () => {
  it('exposes only Flutterwave initialize path constant for funding init', () => {
    expect(FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH).toBe('/payments/flutterwave/initialize');
    expect(FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH).not.toContain(forbiddenSelfCreditWalletPost);
  });

  it('use-wallet.ts must not reference unsafe self-credit wallet POST', () => {
    const src = readRel('lib/hooks/use-wallet.ts');
    expect(src).not.toContain(forbiddenSelfCreditWalletPost);
    expect(src).toContain('FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH');
    expect(src).toContain('flutterwaveWalletFundingVerifyPath');
  });

  it('FundWalletCard must not call unsafe self-credit wallet POST', () => {
    const src = readRel('components/wallet/FundWalletCard.tsx');
    expect(src).not.toContain(forbiddenSelfCreditWalletPost);
    expect(src).toContain('useInitializeWalletPayment');
  });

  it('dashboard fund-wallet page must not reference unsafe self-credit wallet POST', () => {
    const src = readRel(['app', 'dashboard', 'wallets', 'top-up', 'page.tsx'].join('/'));
    expect(src).not.toContain(forbiddenSelfCreditWalletPost);
  });
});
