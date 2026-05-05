import { Injectable } from '@nestjs/common';
import { IdentityVerificationStatus } from '@prisma/client';
import type { KycIdentityVerifier, KycIdentityVerifyResult } from './kyc-identity-verifier.interface';

/**
 * Production-safe default: no third-party automatic BVN/NIN verdict.
 * Identity stays in MANUAL_REVIEW until compliance/admin completes checks.
 */
@Injectable()
export class ManualReviewKycIdentityVerifier implements KycIdentityVerifier {
  async verify(): Promise<KycIdentityVerifyResult> {
    return { status: IdentityVerificationStatus.MANUAL_REVIEW, providerReference: null };
  }
}
