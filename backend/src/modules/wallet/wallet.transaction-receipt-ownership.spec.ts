import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionDirection, TransactionStatus, TransactionType } from '@prisma/client';
import { WalletService } from './wallet.service';

describe('WalletService getTransactionReceipt (Issue 12)', () => {
  const prisma = { transaction: { findFirst: jest.fn(), findMany: jest.fn() } } as any;
  const virtualAccountService = {} as any;
  const notificationsService = {} as any;
  let service: WalletService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WalletService(prisma, virtualAccountService, notificationsService);
  });

  it('throws when transaction group not found', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);
    await expect(service.getTransactionReceipt('u1', 'missing-ref')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids user who has no leg in the transaction group', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      reference: 'G1',
      groupId: 'G1',
      userId: 'someone-else',
    });
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 't1',
        reference: 'G1',
        groupId: 'G1',
        userId: 'someone-else',
        type: TransactionType.WALLET_TOP_UP,
        direction: TransactionDirection.CREDIT,
        amount: { toString: () => '50' },
        fee: null,
        netAmount: null,
        currency: 'NGN',
        status: TransactionStatus.COMPLETED,
        propertyId: null,
        investmentId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        property: null,
      },
    ]);
    await expect(service.getTransactionReceipt('u-innocent', 'G1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows participant and returns pdfAvailable false with disclaimer', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      reference: 'G1',
      groupId: 'G1',
      userId: 'u1',
    });
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 't1',
        reference: 'G1',
        groupId: 'G1',
        userId: 'u1',
        type: TransactionType.WALLET_TOP_UP,
        direction: TransactionDirection.CREDIT,
        amount: { toString: () => '50.0000' },
        fee: { toString: () => '0' },
        netAmount: { toString: () => '50.0000' },
        currency: 'NGN',
        status: TransactionStatus.COMPLETED,
        propertyId: null,
        investmentId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        property: null,
      },
    ]);

    const receipt = await service.getTransactionReceipt('u1', 'G1');
    expect(receipt.pdfAvailable).toBe(false);
    expect(receipt.disclaimer).toBeTruthy();
    expect(JSON.stringify(receipt)).not.toMatch(/sk_live/i);
  });
});
