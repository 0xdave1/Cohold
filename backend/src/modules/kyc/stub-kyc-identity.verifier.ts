import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityVerificationStatus } from '@prisma/client';
import type { KycIdentityVerifier, KycIdentityVerifyResult } from './kyc-identity-verifier.interface';

/**
 * Explicit non-production verifier. Never returns VERIFIED — does not pretend production checks ran.
 */
@Injectable()
export class StubKycIdentityVerifier implements KycIdentityVerifier {
  constructor(private readonly configService: ConfigService) {}

  async verify(): Promise<KycIdentityVerifyResult> {
    const env = this.configService.get<string>('config.app.env') ?? process.env.NODE_ENV ?? 'development';
    if (env === 'production' || env === 'staging') {
      throw new Error('Stub KYC identity verifier must not run in production/staging');
    }
    return {
      status: IdentityVerificationStatus.MANUAL_REVIEW,
      providerReference: 'stub-non-production',
    };
  }
}
