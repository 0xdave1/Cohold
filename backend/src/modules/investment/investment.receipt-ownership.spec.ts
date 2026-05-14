import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvestmentService } from './investment.service';

describe('InvestmentService getInvestmentReceipt (Issue 12)', () => {
  const prisma = {
    investment: { findUnique: jest.fn() },
    distributionPayout: { aggregate: jest.fn() },
    transaction: { findFirst: jest.fn() },
  } as any;
  const walletService = {} as any;
  const notificationsService = {} as any;
  const kycPolicy = {} as any;
  let service: InvestmentService;

  const baseInv = {
    id: 'inv-1',
    userId: 'owner-1',
    propertyId: 'prop-1',
    amount: { toString: () => '1000.0000' },
    shares: { toString: () => '10' },
    ownershipPercent: { toString: () => '0.01' },
    status: 'ACTIVE',
    totalReturns: { toString: () => '5.0000' },
    createdAt: new Date('2024-01-01'),
    property: {
      id: 'prop-1',
      title: 'Test Tower',
      currency: 'NGN',
      annualYield: { toString: () => '0.12' },
      yieldIsProjected: true,
      yieldBasis: 'PROJECTED',
      termMonths: 12,
      listingType: 'FRACTIONAL_OWNERSHIP',
      expectedReturnDisclosure: 'Projected returns are estimates.',
      riskDisclosure: 'Capital at risk.',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InvestmentService(prisma, walletService, notificationsService, kycPolicy);
    prisma.distributionPayout.aggregate.mockResolvedValue({ _sum: { amount: { toString: () => '2.0000' } }, _count: { id: 1 } });
    prisma.transaction.findFirst.mockResolvedValue({
      reference: 'GRP-1',
      groupId: 'GRP-1',
      ledgerOperationId: 'op-1',
      createdAt: new Date('2024-01-02'),
    });
  });

  it('forbids another user from accessing the receipt', async () => {
    prisma.investment.findUnique.mockResolvedValue(baseInv);
    await expect(service.getInvestmentReceipt('inv-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found when investment does not exist', async () => {
    prisma.investment.findUnique.mockResolvedValue(null);
    await expect(service.getInvestmentReceipt('missing', 'owner-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows owner and returns truthful receipt metadata', async () => {
    prisma.investment.findUnique.mockResolvedValue(baseInv);
    const receipt = await service.getInvestmentReceipt('inv-1', 'owner-1');

    expect(receipt.pdfAvailable).toBe(false);
    expect(receipt.disclaimer).toMatch(/not a land title/i);
    expect(receipt.kind).toBe('INVESTMENT_POSITION_RECEIPT');
    expect(receipt.userId).toBe('owner-1');

    const serialized = JSON.stringify(receipt);
    expect(serialized).not.toMatch(/sk_live/i);
    expect(serialized).not.toMatch(/Bearer\s+ey/i);
  });
});
