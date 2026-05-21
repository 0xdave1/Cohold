import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WALLET_FUNDING_INITIALIZE_PATH } from '@/lib/constants/wallet-funding';

const forbiddenSelfCreditWalletPost = '/wallets/top-up';

describe('wallet funding security', () => {
  it('exposes only Paystack-backed initialize path for funding init', () => {
    expect(WALLET_FUNDING_INITIALIZE_PATH).toBe('/payments/initialize');
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toContain(forbiddenSelfCreditWalletPost);
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toContain('flutterwave');
  });

  it('use-wallet hook uses server initialize + verify only', () => {
    const src = readFileSync(join(process.cwd(), 'lib/hooks/use-wallet.ts'), 'utf8');
    expect(src).toContain('WALLET_FUNDING_INITIALIZE_PATH');
    expect(src).toContain('walletFundingVerifyPath');
    expect(src).toContain('amountNaira');
    expect(src).not.toMatch(/post\([\s\S]*currency:\s*['"]NGN['"]/);
    expect(src).not.toContain('flutterwave');
  });
});
