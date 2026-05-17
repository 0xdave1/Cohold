import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';
import { KycStatus, SupportStatus, VirtualAccountStatus, WithdrawalStatus } from '@prisma/client';
import { KycService } from '../kyc/kyc.service';

describe('UsersService getDashboardSummary (Issue 12)', () => {
  let service: UsersService;

  const prismaMock = {
    wallet: { findMany: jest.fn() },
    withdrawal: { aggregate: jest.fn() },
    investment: { aggregate: jest.fn() },
    distributionPayout: { aggregate: jest.fn() },
    user: { findUnique: jest.fn() },
    virtualAccount: { findFirst: jest.fn() },
    notification: { count: jest.fn() },
    supportConversation: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.wallet.findMany.mockResolvedValue([{ currency: 'NGN', balance: { toString: () => '100.0000' } }]);
    prismaMock.withdrawal.aggregate.mockResolvedValue({
      _count: { id: 0 },
      _sum: { netAmount: null },
    });
    prismaMock.investment.aggregate.mockResolvedValue({
      _count: { id: 1 },
      _sum: { amount: { toString: () => '5000.0000' } },
    });
    prismaMock.distributionPayout.aggregate.mockResolvedValue({
      _count: { id: 2 },
      _sum: { amount: { toString: () => '120.5000' } },
    });
    prismaMock.user.findUnique.mockResolvedValue({ kycStatus: KycStatus.VERIFIED });
    prismaMock.virtualAccount.findFirst.mockResolvedValue({
      status: VirtualAccountStatus.ACTIVE,
      accountNumber: '0123456789',
      bankName: 'Providus',
    });
    prismaMock.notification.count.mockResolvedValue(3);
    prismaMock.supportConversation.count.mockResolvedValue(1);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: {} },
        { provide: PAYOUT_PROVIDER, useValue: {} },
        {
          provide: KycService,
          useValue: { reconcileUserKycSnapshotIfDrifted: jest.fn().mockResolvedValue(KycStatus.VERIFIED) },
        },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('keeps paid distribution totals separate from projected yield (unsupported portfolio projection)', async () => {
    const out = await service.getDashboardSummary('user-1');
    expect(out.paidDistributionsFromPayouts.totalAmount).toBe('120.5000');
    expect(out.projectedPortfolioYield.value).toBeNull();
    expect(out.projectedPortfolioYield.unsupportedReason).toMatch(/projected/i);
    expect(out.openSupportTicketsCount).toBe(1);
    expect(prismaMock.supportConversation.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: SupportStatus.OPEN },
    });
  });

  it('does not treat pending withdrawals as paid returns', async () => {
    prismaMock.withdrawal.aggregate.mockResolvedValue({
      _count: { id: 2 },
      _sum: { netAmount: { toString: () => '50.0000' } },
    });
    const out = await service.getDashboardSummary('user-1');
    expect(out.pendingWithdrawals.count).toBe(2);
    expect(out.pendingWithdrawals.totalNetAmount).toBe('50.0000');
    expect(out.paidDistributionsFromPayouts.totalAmount).toBe('120.5000');
    expect(prismaMock.withdrawal.aggregate).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: {
          in: [
            WithdrawalStatus.PENDING,
            WithdrawalStatus.INITIATING,
            WithdrawalStatus.PROCESSING,
            WithdrawalStatus.RECONCILIATION_REQUIRED,
          ],
        },
      },
      _count: { id: true },
      _sum: { netAmount: true },
    });
  });

  it('masks virtual account number in dashboard payload', async () => {
    const out = await service.getDashboardSummary('user-1');
    expect(out.virtualAccount.accountNumberLast4).toBe('****6789');
    expect(JSON.stringify(out)).not.toContain('0123456789');
  });
});
