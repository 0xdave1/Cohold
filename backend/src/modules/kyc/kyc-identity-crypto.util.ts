import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'crypto';

export type IdentityKind = 'BVN' | 'NIN';

const GCM_IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class IdentityCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityCryptoError';
  }
}

export function normalizeIdentity(value: string, _type: IdentityKind): string {
  return value.replace(/[\s-]/g, '').trim();
}

export function validateIdentityFormat(normalized: string, type: IdentityKind): void {
  if (!/^\d{11}$/.test(normalized)) {
    throw new IdentityCryptoError(`Invalid ${type} format`);
  }
}

export function maskIdentityLast4(normalized: string): string {
  if (normalized.length < 4) return '****';
  return normalized.slice(-4);
}

export function parseAes256GcmKey(raw: string | undefined, label: string): Buffer {
  if (!raw?.trim()) {
    throw new IdentityCryptoError(`${label} is required`);
  }
  const t = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(t)) {
    return Buffer.from(t, 'hex');
  }
  const b64 = Buffer.from(t, 'base64');
  if (b64.length === 32) {
    return b64;
  }
  throw new IdentityCryptoError(`${label} must decode to 32 bytes (64 hex chars or base64)`);
}

export function assertHashSecret(raw: string | undefined, label: string): string {
  if (!raw?.trim()) {
    throw new IdentityCryptoError(`${label} is required`);
  }
  if (raw.trim().length < 32) {
    throw new IdentityCryptoError(`${label} must be at least 32 characters`);
  }
  return raw.trim();
}

export function hashSensitiveIdentity(secret: string, type: IdentityKind, normalized: string): string {
  return createHmac('sha256', secret).update(`${type}:${normalized}`, 'utf8').digest('hex');
}

export function encryptSensitiveIdentity(aesKey: Buffer, plaintext: string): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSensitiveIdentity(aesKey: Buffer, payloadB64: string): string {
  const buf = Buffer.from(payloadB64, 'base64');
  if (buf.length < GCM_IV_LENGTH + TAG_LENGTH + 1) {
    throw new IdentityCryptoError('Invalid ciphertext');
  }
  const iv = buf.subarray(0, GCM_IV_LENGTH);
  const tag = buf.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(GCM_IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Derive deterministic test keys (never use in production). */
export function deriveTestKeyMaterial(seed: string): { aesKey: Buffer; hashSecret: string } {
  const aesKey = scryptSync(seed, 'kyc-test-aes', 32);
  const hashSecret = scryptSync(seed, 'kyc-test-hmac', 64).toString('hex');
  return { aesKey, hashSecret };
}
