import { describe, expect, it } from 'vitest';
import { FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH } from './wallet-funding';

describe('wallet funding paths (Issue 1 / 3)', () => {
  it('does not use removed self-credit wallet top-up route', () => {
    expect(FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH).toContain('flutterwave');
    expect(FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH).not.toContain('top-up');
    expect(FLUTTERWAVE_WALLET_FUNDING_INITIALIZE_PATH).not.toMatch(/\/wallets\/.*credit/i);
  });
});
