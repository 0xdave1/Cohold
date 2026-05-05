import { KycComplianceBootstrapService } from './kyc-compliance-bootstrap.service';

describe('KycComplianceBootstrapService', () => {
  it('forbids stub identity verifier in production', () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'config.app.env': 'production',
          'config.kyc.identityProviderMode': 'stub',
          'config.kyc.autoVerificationRequired': false,
        };
        return map[key];
      }),
    } as any;
    const svc = new KycComplianceBootstrapService(config);
    expect(() => svc.onModuleInit()).toThrow(/stub is forbidden/);
  });

  it('forbids auto-verification-required without real provider in production', () => {
    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'config.app.env': 'production',
          'config.kyc.identityProviderMode': 'manual',
          'config.kyc.autoVerificationRequired': true,
        };
        return map[key];
      }),
    } as any;
    const svc = new KycComplianceBootstrapService(config);
    expect(() => svc.onModuleInit()).toThrow(/KYC_AUTO_VERIFICATION_REQUIRED=true/);
  });
});
