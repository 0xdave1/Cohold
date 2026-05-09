import { redactJsonForAuditPersistence, redactSensitive, sanitizeErrorForLog } from './security-redaction.util';

describe('security-redaction util', () => {
  it('redacts nested sensitive keys', () => {
    const input = {
      authorization: 'Bearer abcdefghijklmnop',
      nested: {
        password: 'secret1234',
        profile: {
          bvn: '12345678901',
          nin: '99887766554',
          token: 'tok_xyz_12345',
          otp: '1234567890',
          accountNumber: '0123456789',
        },
      },
      safe: 'ok',
    };
    const out = redactSensitive(input);
    expect(String(out.authorization)).toContain('***');
    expect(String((out as any).nested.password)).toContain('***');
    expect(String((out as any).nested.profile.bvn)).toContain('***');
    expect(String((out as any).nested.profile.nin)).toContain('***');
    expect(String((out as any).nested.profile.otp)).toContain('***');
    expect(String((out as any).nested.profile.accountNumber)).toContain('***');
    expect((out as any).safe).toBe('ok');
  });

  it('sanitizes error payload', () => {
    const err = new Error('boom');
    expect(sanitizeErrorForLog(err)).toEqual({ name: 'Error', message: 'boom' });
  });

  it('redactJsonForAuditPersistence masks Issue 11 audit keys (cookie, OTP, provider secrets, signature, bank)', () => {
    const input = {
      cookie: 'session=abc123def456',
      headers: { 'set-cookie': 'a=b' },
      otp: '987654',
      flutterwave_secret_key: 'sk_live_xxxxx',
      provider: { webhookSecret: 'whsec_xxx', signature: 'sig_hmac_body' },
      bank: { accountNumber: '0123456789012345' },
      nested: { accessToken: 'at_secret', refreshToken: 'rt_secret' },
      safe: 'visible',
    };
    const out = redactJsonForAuditPersistence(input) as Record<string, unknown>;
    const masked = (v: unknown) => {
      const s = String(v);
      return s.includes('***') || s === '[REDACTED]';
    };
    expect(masked(out.cookie)).toBe(true);
    expect(masked(out.otp)).toBe(true);
    expect(masked((out.provider as Record<string, unknown>).webhookSecret)).toBe(true);
    expect(masked((out.provider as Record<string, unknown>).signature)).toBe(true);
    expect(masked((out.bank as Record<string, unknown>).accountNumber)).toBe(true);
    expect(out.safe).toBe('visible');
  });

  it('redactJsonForAuditPersistence masks digit runs inside arbitrary strings', () => {
    const out = redactJsonForAuditPersistence({
      note: 'Payout failed for account 12345678901234',
    }) as { note: string };
    expect(out.note).not.toContain('12345678901234');
  });
});

