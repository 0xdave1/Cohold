import { ForbiddenException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { KycPolicyService } from './kyc-policy.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('KycPolicyService', () => {
  const prismaMock = {
    user: { findUnique: jest.fn() },
  };
  let service: KycPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KycPolicyService(prismaMock as unknown as PrismaService);
  });

  it('allows money movement when User.kycStatus is VERIFIED', () => {
    expect(() =>
      service.assertFromUserSnapshot({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
    ).not.toThrow();
  });

  it('blocks money movement when User.kycStatus is not VERIFIED', () => {
    expect(() =>
      service.assertFromUserSnapshot({ isFrozen: false, kycStatus: KycStatus.PENDING }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertFromUserSnapshot({ isFrozen: false, kycStatus: KycStatus.REQUIRES_REVIEW }),
    ).toThrow(ForbiddenException);
  });

  it('assertUserKycVerifiedForMoneyMovement loads User.kycStatus snapshot', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    await expect(service.assertUserKycVerifiedForMoneyMovement('u1')).resolves.toBeUndefined();
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { isFrozen: true, kycStatus: true },
    });
  });
});
