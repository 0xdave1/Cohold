import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Currency,
  DistributionBatchItemStatus,
  DistributionBatchStatus,
  PropertyIncomeEventStatus,
  PropertyIncomeEventType,
} from '@prisma/client';
import { DistributionService } from './distribution.service';

describe('DistributionService (Issue 8 integrity)', () => {
  const prisma = {
    property: { findFirst: jest.fn() },
    propertyIncomeEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    distributionBatch: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    distributionBatchItem: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    investment: { findMany: jest.fn() },
    wallet: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
    adminActivityLog: { create: jest.fn() },
    $transaction: jest.fn(),
  } as any;

  const walletService = {
    getPropertyIncomeWallet: jest.fn(),
    getPlatformWallet: jest.fn(),
    postDoubleEntry: jest.fn(),
  } as any;

  const notifications = {
    notifyRoiCredited: jest.fn(),
  } as any;

  let service: DistributionService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new DistributionService(prisma, walletService, notifications);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.distributionBatchItem.count.mockResolvedValue(0);
  });

  it('distribution cannot run without approved income event', async () => {
    prisma.distributionBatch.findUnique.mockResolvedValue({
      id: 'b1',
      propertyId: 'p1',
      currency: Currency.NGN,
      status: DistributionBatchStatus.APPROVED,
      incomeEvent: { status: PropertyIncomeEventStatus.PENDING },
    });
    await expect(service.processDistributionBatch('b1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approve income event credits property income wallet', async () => {
    prisma.propertyIncomeEvent.findUnique.mockResolvedValue({
      id: 'ie1',
      propertyId: 'p1',
      currency: Currency.NGN,
      amount: '100.0000',
      status: PropertyIncomeEventStatus.PENDING,
    });
    walletService.getPropertyIncomeWallet.mockResolvedValue({ id: 'iw1', userId: 'INCOME_PROPERTY_p1' });
    walletService.getPlatformWallet.mockResolvedValue({ id: 'pw1' });
    walletService.postDoubleEntry.mockResolvedValue({ legs: [{ ledgerOperationId: 'INCOME_EVENT:ie1' }], created: true });
    prisma.propertyIncomeEvent.update.mockResolvedValue({ id: 'ie1', status: PropertyIncomeEventStatus.POSTED });
    prisma.propertyIncomeEvent.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'ie1', status: PropertyIncomeEventStatus.POSTED });
    await service.approveIncomeEvent('admin1', 'ie1');
    expect(walletService.getPropertyIncomeWallet).toHaveBeenCalled();
    expect(walletService.postDoubleEntry).toHaveBeenCalled();
  });

  it('annualYield alone cannot create payable distribution', async () => {
    prisma.propertyIncomeEvent.findUnique.mockResolvedValue(null);
    await expect(
      service.createDistributionBatch('admin1', { incomeEventId: 'missing' }),
    ).rejects.toThrow('Income event not found');
  });

  it('conflicting distribution reference rejects', async () => {
    prisma.propertyIncomeEvent.findUnique.mockResolvedValue({
      id: 'ie1',
      propertyId: 'p1',
      currency: Currency.NGN,
      amount: '100.0000',
      status: PropertyIncomeEventStatus.POSTED,
    });
    prisma.distributionBatch.findUnique.mockResolvedValue({
      id: 'b1',
      metadata: { fingerprint: 'different' },
    });
    await expect(
      service.createDistributionBatch('admin1', { incomeEventId: 'ie1', reference: 'REF-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rounding does not exceed net distributable in preview build', async () => {
    prisma.propertyIncomeEvent.findUnique.mockResolvedValue({
      id: 'ie1',
      propertyId: 'p1',
      currency: Currency.NGN,
      amount: '10.0000',
      status: PropertyIncomeEventStatus.POSTED,
    });
    prisma.distributionBatch.findUnique.mockResolvedValue(null);
    prisma.investment.findMany.mockResolvedValue([
      { id: 'i1', userId: 'u1', shares: '1.00000000', ownershipPercent: '50.000000' },
      { id: 'i2', userId: 'u2', shares: '1.00000000', ownershipPercent: '50.000000' },
    ]);
    prisma.distributionBatch.create.mockResolvedValue({
      id: 'b1',
      propertyId: 'p1',
      incomeEventId: 'ie1',
      netDistributable: '10.0000',
    });
    await service.createDistributionBatch('admin1', { incomeEventId: 'ie1' });
    const createManyArg = prisma.distributionBatchItem.createMany.mock.calls[0][0].data;
    const total = createManyArg.reduce((a: number, r: any) => a + Number(r.amount), 0);
    expect(total).toBeLessThanOrEqual(10);
  });

  it('insufficient property income wallet balance fails safely', async () => {
    prisma.distributionBatch.findUnique.mockResolvedValue({
      id: 'b1',
      propertyId: 'p1',
      currency: Currency.NGN,
      status: DistributionBatchStatus.APPROVED,
      incomeEvent: { status: PropertyIncomeEventStatus.POSTED },
      periodStart: null,
      periodEnd: null,
    });
    prisma.distributionBatch.update.mockResolvedValue({ id: 'b1', createdByAdminId: 'admin1' });
    prisma.distributionBatchItem.findMany.mockResolvedValue([
      { id: 'it1', amount: '100.0000', userId: 'u1', investmentId: 'i1' },
    ]);
    walletService.getPropertyIncomeWallet.mockResolvedValue({ id: 'iw1', userId: 'INCOME_PROPERTY_p1' });
    prisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: 'iw1', balance: '10.0000' });
    await expect(service.processDistributionBatch('b1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('duplicate item process does not double-credit posted items', async () => {
    prisma.distributionBatch.findUnique.mockResolvedValue({
      id: 'b1',
      propertyId: 'p1',
      currency: Currency.NGN,
      status: DistributionBatchStatus.PARTIALLY_FAILED,
      incomeEvent: { status: PropertyIncomeEventStatus.POSTED },
      periodStart: null,
      periodEnd: null,
    });
    prisma.distributionBatchItem.findMany.mockResolvedValue([]);
    walletService.getPropertyIncomeWallet.mockResolvedValue({ id: 'iw1', userId: 'INCOME_PROPERTY_p1' });
    prisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: 'iw1', balance: '10.0000' });
    prisma.distributionBatchItem.count.mockResolvedValue(0);
    prisma.distributionBatch.update.mockResolvedValue({
      id: 'b1',
      status: DistributionBatchStatus.COMPLETED,
      createdByAdminId: 'admin1',
    });
    const out = await service.processDistributionBatch('b1');
    expect(out.posted).toBe(0);
    expect(walletService.postDoubleEntry).not.toHaveBeenCalled();
  });

  it('user distribution history returns only current user items', async () => {
    prisma.distributionBatchItem.findMany.mockResolvedValue([{ id: 'it1', userId: 'u1' }]);
    prisma.distributionBatchItem.count.mockResolvedValue(1);
    const out = await service.listUserDistributionHistory('u1', 1, 20);
    expect(prisma.distributionBatchItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(out.meta.total).toBe(1);
  });

  it('notifications fire only after posted item', async () => {
    prisma.distributionBatch.findUnique.mockResolvedValue({
      id: 'b1',
      propertyId: 'p1',
      currency: Currency.NGN,
      status: DistributionBatchStatus.APPROVED,
      incomeEvent: { status: PropertyIncomeEventStatus.POSTED },
      periodStart: null,
      periodEnd: null,
    });
    prisma.distributionBatch.update.mockResolvedValue({ id: 'b1', createdByAdminId: 'admin1' });
    prisma.distributionBatchItem.findMany.mockResolvedValue([
      { id: 'it1', amount: '1.0000', userId: 'u1', investmentId: null },
    ]);
    walletService.getPropertyIncomeWallet.mockResolvedValue({ id: 'iw1', userId: 'INCOME_PROPERTY_p1' });
    prisma.wallet.findUniqueOrThrow.mockResolvedValue({ id: 'iw1', balance: '100.0000' });
    prisma.wallet.findUnique.mockResolvedValue({ id: 'uw1', userId: 'u1' });
    walletService.postDoubleEntry.mockResolvedValue({ legs: [{ ledgerOperationId: 'lop1' }], created: true });
    prisma.distributionBatchItem.update.mockResolvedValue({ id: 'it1', status: DistributionBatchItemStatus.POSTED });
    prisma.distributionBatchItem.count.mockResolvedValue(0);
    prisma.distributionBatch.update.mockResolvedValue({
      id: 'b1',
      status: DistributionBatchStatus.COMPLETED,
      createdByAdminId: 'admin1',
    });
    await service.processDistributionBatch('b1');
    expect(notifications.notifyRoiCredited).toHaveBeenCalledTimes(1);
  });

  it('projected yield API path is disabled for payouts', async () => {
    await expect(service.distributeMonthlyRentalYield('p1', 'a1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create income event stores lifecycle as pending', async () => {
    prisma.property.findFirst.mockResolvedValue({ id: 'p1', currency: Currency.NGN });
    prisma.propertyIncomeEvent.create.mockResolvedValue({ id: 'ie1', status: PropertyIncomeEventStatus.PENDING });
    const out = await service.createIncomeEvent('a1', {
      propertyId: 'p1',
      amount: '10',
      currency: Currency.NGN,
      type: PropertyIncomeEventType.RENT,
      receivedAt: new Date().toISOString(),
    });
    expect(out.id).toBe('ie1');
  });
});
