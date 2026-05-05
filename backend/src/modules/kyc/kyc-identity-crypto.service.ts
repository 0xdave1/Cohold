import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertHashSecret,
  decryptSensitiveIdentity as aesDecrypt,
  deriveTestKeyMaterial,
  encryptSensitiveIdentity as aesEncrypt,
  hashSensitiveIdentity,
  IdentityCryptoError,
  parseAes256GcmKey,
  type IdentityKind,
} from './kyc-identity-crypto.util';

@Injectable()
export class KycIdentityCryptoService implements OnModuleInit {
  private aesKey!: Buffer;
  private hashSecret!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const env = this.configService.get<string>('config.app.env') ?? process.env.NODE_ENV ?? 'development';
    const prodLike = env === 'production' || env === 'staging';
    const enc = this.configService.get<string>('config.kyc.encryptionKey');
    const hash = this.configService.get<string>('config.kyc.hashSecret');

    if (prodLike) {
      if (!enc?.trim() || !hash?.trim()) {
        throw new Error('KYC_ENCRYPTION_KEY and KYC_HASH_SECRET are required in production/staging (Issue 5).');
      }
      this.aesKey = parseAes256GcmKey(enc, 'KYC_ENCRYPTION_KEY');
      this.hashSecret = assertHashSecret(hash, 'KYC_HASH_SECRET');
      return;
    }

    if (enc?.trim() && hash?.trim()) {
      this.aesKey = parseAes256GcmKey(enc, 'KYC_ENCRYPTION_KEY');
      this.hashSecret = assertHashSecret(hash, 'KYC_HASH_SECRET');
      return;
    }

    const jwt = this.configService.get<string>('config.jwt.accessSecret');
    const { aesKey, hashSecret } = deriveTestKeyMaterial(jwt ?? 'cohold-dev-kyc-encryption-insecure');
    this.aesKey = aesKey;
    this.hashSecret = hashSecret;
  }

  hashIdentity(type: IdentityKind, normalized: string): string {
    return hashSensitiveIdentity(this.hashSecret, type, normalized);
  }

  encryptSensitiveIdentity(plaintext: string): string {
    return aesEncrypt(this.aesKey, plaintext);
  }

  decryptSensitiveIdentity(ciphertext: string): string {
    return aesDecrypt(this.aesKey, ciphertext);
  }
}

export { IdentityCryptoError };
