import type { IdentityVerificationStatus } from '@prisma/client';

export const KYC_IDENTITY_VERIFIER = Symbol('KYC_IDENTITY_VERIFIER');

export type KycIdentityKind = 'BVN' | 'NIN';

export interface KycIdentityVerifyResult {
  status: IdentityVerificationStatus;
  providerReference?: string | null;
}

export interface KycIdentityVerifier {
  verify(input: {
    type: KycIdentityKind;
    normalized: string;
    userId: string;
  }): Promise<KycIdentityVerifyResult>;
}
