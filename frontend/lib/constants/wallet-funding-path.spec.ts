import { WALLET_FUNDING_INITIALIZE_PATH } from './wallet-funding';

describe('wallet funding paths', () => {
  it('uses generic Paystack-backed initialize endpoint', () => {
    expect(WALLET_FUNDING_INITIALIZE_PATH).toBe('/payments/initialize');
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toContain('flutterwave');
    expect(WALLET_FUNDING_INITIALIZE_PATH).not.toMatch(/\/wallets\/.*credit/i);
  });
});
