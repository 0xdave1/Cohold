import {
  IdentityCryptoError,
  decryptSensitiveIdentity,
  deriveTestKeyMaterial,
  encryptSensitiveIdentity,
  hashSensitiveIdentity,
  normalizeIdentity,
  parseAes256GcmKey,
  validateIdentityFormat,
} from './kyc-identity-crypto.util';

describe('kyc-identity-crypto util', () => {
  it('supports encryption round trip and ciphertext differs from plaintext', () => {
    const { aesKey } = deriveTestKeyMaterial('issue5-seed');
    const plaintext = '12345678901';
    const ciphertext = encryptSensitiveIdentity(aesKey, plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptSensitiveIdentity(aesKey, ciphertext)).toBe(plaintext);
  });

  it('produces deterministic HMAC hash per value and type', () => {
    const secret = 'k'.repeat(64);
    const h1 = hashSensitiveIdentity(secret, 'BVN', '12345678901');
    const h2 = hashSensitiveIdentity(secret, 'BVN', '12345678901');
    const h3 = hashSensitiveIdentity(secret, 'BVN', '12345678902');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('normalizes identity by stripping spaces and dashes', () => {
    expect(normalizeIdentity('1234-567 8901', 'NIN')).toBe('12345678901');
  });

  it('rejects invalid BVN/NIN format', () => {
    expect(() => validateIdentityFormat('abc', 'BVN')).toThrow(IdentityCryptoError);
    expect(() => validateIdentityFormat('1234567890', 'NIN')).toThrow(IdentityCryptoError);
  });

  it('rejects invalid AES key material', () => {
    expect(() => parseAes256GcmKey('short', 'KYC_ENCRYPTION_KEY')).toThrow(IdentityCryptoError);
  });
});
