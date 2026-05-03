import { FlutterwavePayoutProvider } from './flutterwave-payout.provider';

describe('FlutterwavePayoutProvider', () => {
  const makeProvider = (secret: string) =>
    new FlutterwavePayoutProvider({
      get: (key: string) => {
        const map: Record<string, string> = {
          'config.flutterwave.secretKey': 'sk_test',
          'config.flutterwave.webhookSecret': secret,
        };
        return map[key];
      },
    } as any);

  it('verifyWebhookSignature returns false when secret is missing', () => {
    const p = makeProvider('');
    expect(p.verifyWebhookSignature({ 'verif-hash': 'x' }, Buffer.from('{}'))).toBe(false);
  });

  it('verifyWebhookSignature returns true when hash matches secret', () => {
    const secret = 'whsec_test';
    const p = makeProvider(secret);
    expect(p.verifyWebhookSignature({ 'verif-hash': secret }, Buffer.from('{}'))).toBe(true);
  });

  it('getTransferStatus maps SUCCESSFUL to SUCCESS', async () => {
    const p = makeProvider('whsec_test');
    (p as any).client.get = jest.fn().mockResolvedValue({
      data: {
        status: 'success',
        data: {
          id: 99,
          reference: 'WD-xyz',
          status: 'SUCCESSFUL',
          complete_message: 'ok',
        },
      },
    });
    const out = await p.getTransferStatus('99');
    expect(out.status).toBe('SUCCESS');
    expect(out.transferCode).toBe('99');
  });

  it('initiateTransfer marks axios network errors as ambiguous UNKNOWN', async () => {
    const p = makeProvider('whsec_test');
    (p as any).client.post = jest.fn().mockRejectedValue({ isAxiosError: true, response: undefined });
    const out = await p.initiateTransfer({
      amount: '10',
      currency: 'NGN',
      reference: 'WD-net',
      narration: 't',
      accountNumber: '1',
      bankCode: '058',
      accountName: 'A',
    });
    expect(out.ambiguous).toBe(true);
    expect(out.status).toBe('UNKNOWN');
  });
});
