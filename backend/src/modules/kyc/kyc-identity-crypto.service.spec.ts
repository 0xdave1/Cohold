import { KycIdentityCryptoService } from './kyc-identity-crypto.service';

describe('KycIdentityCryptoService', () => {
  it('fails startup in production without encryption/hash keys', () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'config.app.env': 'production',
          'config.kyc.encryptionKey': undefined,
          'config.kyc.hashSecret': undefined,
          'config.jwt.accessSecret': 'x'.repeat(40),
        };
        return map[key];
      }),
    } as any;
    const svc = new KycIdentityCryptoService(config);
    expect(() => svc.onModuleInit()).toThrow(/KYC_ENCRYPTION_KEY and KYC_HASH_SECRET/);
  });

  it('encrypts/decrypts and hashes with configured keys', () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'config.app.env': 'development',
          'config.kyc.encryptionKey': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'config.kyc.hashSecret': 'h'.repeat(64),
          'config.jwt.accessSecret': 'x'.repeat(40),
        };
        return map[key];
      }),
    } as any;
    const svc = new KycIdentityCryptoService(config);
    svc.onModuleInit();
    const ciphertext = svc.encryptSensitiveIdentity('12345678901');
    expect(ciphertext).not.toBe('12345678901');
    expect(svc.decryptSensitiveIdentity(ciphertext)).toBe('12345678901');
    expect(svc.hashIdentity('BVN', '12345678901')).toHaveLength(64);
  });
});
