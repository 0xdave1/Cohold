import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvestmentService } from './investment.service';

describe('InvestmentService KYC gating', () => {
  const prisma = {
    investment: { findFirst: jest.fn() },
    transaction: { findFirst: jest.fn() },
    property: { findFirst: jest.fn() },
  } as any;
  const walletService = {} as any;
  const notifications = {} as any;
  const kycPolicy = {
    assertUserKycVerifiedForMoneyMovement: jest.fn(),
  } as any;

  let service: InvestmentService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InvestmentService(prisma, walletService, notifications, kycPolicy);
    prisma.investment.findFirst.mockResolvedValue(null);
    prisma.transaction.findFirst.mockResolvedValue(null);
  });

  it('rejects investment when user is not KYC-verified', async () => {
    kycPolicy.assertUserKycVerifiedForMoneyMovement.mockRejectedValue(
      new ForbiddenException({ code: 'KYC_REQUIRED' }),
    );
    await expect(
      service.createFractional('u1', { propertyId: 'p1', shares: '1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.property.findFirst).not.toHaveBeenCalled();
  });

  it('verified user proceeds past KYC gate into property lookup', async () => {
    kycPolicy.assertUserKycVerifiedForMoneyMovement.mockResolvedValue(undefined);
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.createFractional('u1', { propertyId: 'p1', shares: '1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(kycPolicy.assertUserKycVerifiedForMoneyMovement).toHaveBeenCalledWith('u1');
    expect(prisma.property.findFirst).toHaveBeenCalled();
  });
});
