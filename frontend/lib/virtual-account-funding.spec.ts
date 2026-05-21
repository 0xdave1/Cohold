import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WALLET_FUNDING_INITIALIZE_PATH } from './constants/wallet-funding';

describe('virtual account + wallet funding rails', () => {
  it('funding path uses generic Paystack-backed initialize endpoint', () => {
    expect(WALLET_FUNDING_INITIALIZE_PATH).toBe('/payments/initialize');
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toContain('flutterwave');
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toMatch(/\/wallets\/.*credit/i);
  });

  it('top-up page uses Pay securely copy and no Flutterwave', () => {
    const src = readFileSync(join(process.cwd(), 'app/dashboard/wallets/top-up/page.tsx'), 'utf8');
    expect(src).toContain('Pay securely');
    expect(src).toContain('Bank transfer (dedicated account)');
    expect(src).not.toMatch(/Flutterwave/i);
    expect(src).not.toMatch(/instant balance/i);
  });

  it('wallet page verifies after redirect without optimistic balance update', () => {
    const walletPage = readFileSync(join(process.cwd(), 'app/dashboard/wallet/page.tsx'), 'utf8');
    expect(walletPage).toContain('useVerifyWalletPayment');
    expect(walletPage).toContain('walletFundingReference');
    expect(walletPage).toMatch(/Do not invalidate\/refetch balances here/);
    expect(walletPage).not.toMatch(/Flutterwave/i);
    expect(walletPage).toContain('FundWalletCard');

    const fundCard = readFileSync(join(process.cwd(), 'components/wallet/FundWalletCard.tsx'), 'utf8');
    expect(fundCard).toContain('Pay securely');
    expect(fundCard).not.toMatch(/Flutterwave/i);
    expect(fundCard).not.toMatch(/instant balance/i);
    expect(fundCard).toContain('amountNaira');
    expect(fundCard).not.toContain('currency');
  });
});
