import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvestmentService } from './investment.service';

describe('InvestmentService KYC gating', () => {
  const prisma = {
    investment: { findFirst: jest.fn(), findUnique: jest.fn() },
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

  it('blocks cross-user investment detail access', async () => {
    prisma.investment.findUnique.mockResolvedValue({
      id: 'inv-1',
      userId: 'owner-1',
      property: null,
    });
    await expect(service.getInvestment('inv-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows owner investment detail access', async () => {
    prisma.investment.findUnique.mockResolvedValue({
      id: 'inv-1',
      userId: 'owner-1',
      property: null,
    });
    const row = await service.getInvestment('inv-1', 'owner-1');
    expect(row.id).toBe('inv-1');
  });

  it('direct investment checkout is honestly disabled', async () => {
    prisma.property.findFirst.mockResolvedValue({
      id: 'p1',
      status: 'PUBLISHED',
      sharePrice: '10000',
      minInvestment: '10000',
      deletedAt: null,
    });
    await expect(
      service.initializeInvestmentPayment('u1', 'p1', '1', 'user@example.com'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
