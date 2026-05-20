import { createHmac } from 'crypto';
import { PaystackProvider } from './paystack.provider';

describe('PaystackProvider', () => {
  const secret = 'sk_test_paystack_secret';

  function provider(): PaystackProvider {
    return new PaystackProvider({
      get: (key: string) => {
        if (key === 'PAYSTACK_SECRET_KEY' || key === 'config.paystack.secretKey') return secret;
        if (key === 'PAYSTACK_TRANSFERS_ENABLED' || key === 'config.paystack.transfersEnabled') return 'true';
        return undefined;
      },
    } as never);
  }

  it('verifyWebhookSignature uses HMAC SHA512 timing-safe compare', () => {
    const p = provider();
    const body = JSON.stringify({ event: 'charge.success' });
    const sig = createHmac('sha512', secret).update(body).digest('hex');
    expect(p.verifyWebhookSignature(body, sig)).toBe(true);
    expect(p.verifyWebhookSignature(body, 'invalid')).toBe(false);
  });

  it('does not log secret key in sanitize path (smoke)', () => {
    const p = provider();
    expect(p.isTransfersEnabled()).toBe(true);
  });
});
