import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KycIdentityCryptoService } from './kyc-identity-crypto.service';
import { KycPolicyService } from './kyc-policy.service';
import { KYC_IDENTITY_VERIFIER } from './kyc-identity-verifier.interface';
import { ManualReviewKycIdentityVerifier } from './manual-review-kyc-identity.verifier';
import { StubKycIdentityVerifier } from './stub-kyc-identity.verifier';
import { KycComplianceBootstrapService } from './kyc-compliance-bootstrap.service';

@Module({
  imports: [ConfigModule],
  providers: [
    KycIdentityCryptoService,
    KycPolicyService,
    ManualReviewKycIdentityVerifier,
    StubKycIdentityVerifier,
    KycComplianceBootstrapService,
    {
      provide: KYC_IDENTITY_VERIFIER,
      useFactory: (
        config: ConfigService,
        manual: ManualReviewKycIdentityVerifier,
        stub: StubKycIdentityVerifier,
      ) => {
        const mode = (config.get<string>('config.kyc.identityProviderMode') ?? 'manual').toLowerCase();
        return mode === 'stub' ? stub : manual;
      },
      inject: [ConfigService, ManualReviewKycIdentityVerifier, StubKycIdentityVerifier],
    },
  ],
  exports: [KycIdentityCryptoService, KycPolicyService, KYC_IDENTITY_VERIFIER],
})
export class KycComplianceModule {}
