import { PaystackPayoutProvider } from './paystack-payout.provider';

describe('PaystackPayoutProvider', () => {
  it('returns honest failure when transfers disabled', async () => {
    const paystack = { isTransfersEnabled: () => false };
    const provider = new PaystackPayoutProvider(paystack as never);
    const result = await provider.initiateTransfer({
      amount: '100',
      currency: 'NGN',
      reference: 'wd-ref',
      narration: 'withdrawal',
      accountNumber: '0123456789',
      bankCode: '058',
      accountName: 'Test User',
    });
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/not enabled/i);
    expect(result.accepted).toBe(false);
  });
});
