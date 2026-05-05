import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fail-fast configuration for KYC compliance (Issue 5).
 */
@Injectable()
export class KycComplianceBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(KycComplianceBootstrapService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const env = this.configService.get<string>('config.app.env') ?? process.env.NODE_ENV ?? 'development';
    const prodLike = env === 'production' || env === 'staging';
    const mode = this.configService.get<string>('config.kyc.identityProviderMode') ?? 'manual';
    const autoRequired = this.configService.get<boolean>('config.kyc.autoVerificationRequired');

    if (prodLike && mode === 'stub') {
      throw new Error(
        'KYC_IDENTITY_PROVIDER_MODE=stub is forbidden in production/staging. Use manual or a real provider integration.',
      );
    }

    if (prodLike && autoRequired) {
      throw new Error(
        'KYC_AUTO_VERIFICATION_REQUIRED=true but no production automatic BVN/NIN verifier is wired. Disable the flag or integrate a regulated provider.',
      );
    }

    if (mode === 'stub' && !prodLike) {
      this.logger.warn('KYC_IDENTITY_PROVIDER_MODE=stub — identity will never auto-verify (development only).');
    }
  }
}
