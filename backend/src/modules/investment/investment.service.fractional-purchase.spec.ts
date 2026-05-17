import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  InvestmentStatus,
  LedgerOperationType,
  PropertyStatus,
} from '@prisma/client';
import { InvestmentService } from './investment.service';

function decimalLike(value: string) {
  return { toString: () => value };
}

describe('InvestmentService.createFractional (Issue 7 purchase path)', () => {
  const prisma = {
    investment: { findFirst: jest.fn(), findUnique: jest.fn() },
    transaction: { findFirst: jest.fn() },
    property: { findFirst: jest.fn() },
    wallet: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  } as any;

  const walletService = {
    getPlatformWallet: jest.fn(),
    getPropertyEscrowWallet: jest.fn(),
    postDoubleEntry: jest.fn(),
  } as any;

  const notifications = { notifyInvestmentSuccess: jest.fn() } as any;
  const kycPolicy = { assertUserKycVerifiedForMoneyMovement: jest.fn() } as any;

  let service: InvestmentService;

  const publishedProperty = {
    id: 'p1',
    title: 'Test Tower',
    status: PropertyStatus.PUBLISHED,
    currency: Currency.NGN,
    sharePrice: decimalLike('10000.00000000'),
    minInvestment: decimalLike('10000.0000'),
    sharesTotal: decimalLike('100'),
    sharesSold: decimalLike('0'),
    currentRaised: decimalLike('0'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InvestmentService(prisma, walletService, notifications, kycPolicy);
    kycPolicy.assertUserKycVerifiedForMoneyMovement.mockResolvedValue(undefined);
    prisma.investment.findFirst.mockResolvedValue(null);
    prisma.transaction.findFirst.mockResolvedValue(null);
    prisma.property.findFirst.mockResolvedValue(publishedProperty);
    walletService.getPlatformWallet.mockResolvedValue({ id: 'w-platform' });
    walletService.getPropertyEscrowWallet.mockResolvedValue({ id: 'w-escrow' });
    walletService.postDoubleEntry.mockResolvedValue({ legs: [], created: true });
  });

  function mockSuccessfulTransaction() {
    const lockedProperty = {
      sharesSold: decimalLike('0'),
      sharesTotal: decimalLike('100'),
      currentRaised: decimalLike('0'),
      status: PropertyStatus.PUBLISHED,
    };
    const lockedUserWallet = { balance: decimalLike('500000.0000') };

    const tx = {
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([lockedProperty])
        .mockResolvedValueOnce([lockedUserWallet])
        .mockResolvedValue(undefined),
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'w-user', currency: Currency.NGN }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'w-user',
          balance: decimalLike('480000.0000'),
        }),
      },
      investment: {
        create: jest.fn().mockResolvedValue({
          id: 'inv-1',
          amount: decimalLike('20000.0000'),
          currency: Currency.NGN,
          shares: decimalLike('2.00000000'),
          sharePrice: decimalLike('10000.00000000'),
          ownershipPercent: decimalLike('2.000000'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      property: { update: jest.fn().mockResolvedValue({}) },
    };

    prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    return tx;
  }

  it('completes wallet-funded purchase and posts INVESTMENT_PURCHASE ledger', async () => {
    mockSuccessfulTransaction();

    const out = await service.createFractional('u1', { propertyId: 'p1', shares: '2' });

    expect(out).toMatchObject({ status: 'COMPLETED', investmentId: 'inv-1' });
    expect(walletService.postDoubleEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^INV-/),
      expect.any(Array),
      expect.objectContaining({
        operationType: LedgerOperationType.INVESTMENT_PURCHASE,
        sourceModule: 'investment.createFractional',
        sourceId: 'inv-1',
      }),
    );
  });

  it('rejects when insufficient shares remain (inventory guard)', async () => {
    const lockedProperty = {
      sharesSold: decimalLike('99'),
      sharesTotal: decimalLike('100'),
      currentRaised: decimalLike('990000.0000'),
      status: PropertyStatus.PUBLISHED,
    };
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        $queryRawUnsafe: jest.fn().mockResolvedValueOnce([lockedProperty]),
        wallet: { findUnique: jest.fn() },
        investment: { create: jest.fn() },
        property: { update: jest.fn() },
      }),
    );

    await expect(
      service.createFractional('u1', { propertyId: 'p1', shares: '2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(walletService.postDoubleEntry).not.toHaveBeenCalled();
  });

  it('rolls back when ledger post fails (no partial success outside transaction)', async () => {
    const tx = mockSuccessfulTransaction();
    walletService.postDoubleEntry.mockRejectedValue(
      new Error('operator does not exist: text = uuid'),
    );

    await expect(service.createFractional('u1', { propertyId: 'p1', shares: '1' })).rejects.toThrow(
      /operator does not exist|uuid/i,
    );
    expect(tx.investment.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns existing investment for duplicate clientReference without reposting ledger', async () => {
    prisma.investment.findFirst.mockResolvedValue({
      id: 'inv-existing',
      userId: 'u1',
      propertyId: 'p1',
      amount: decimalLike('10000.0000'),
      currency: Currency.NGN,
      shares: decimalLike('1.00000000'),
      sharePrice: decimalLike('10000.00000000'),
      ownershipPercent: decimalLike('1.000000'),
      createdAt: new Date(),
      status: InvestmentStatus.ACTIVE,
    });
    prisma.wallet.findFirst.mockResolvedValue({ balance: decimalLike('0') });

    const out = await service.createFractional('u1', {
      propertyId: 'p1',
      shares: '1',
      clientReference: 'idem-1',
    });

    expect(out.investmentId).toBe('inv-existing');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(walletService.postDoubleEntry).not.toHaveBeenCalled();
  });

  it('rejects conflicting clientReference already used on ledger', async () => {
    prisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1', reference: 'idem-conflict' });

    await expect(
      service.createFractional('u1', {
        propertyId: 'p1',
        shares: '1',
        clientReference: 'idem-conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('still enforces KYC gate before property lookup', async () => {
    kycPolicy.assertUserKycVerifiedForMoneyMovement.mockRejectedValue(
      new ForbiddenException({ code: 'KYC_REQUIRED' }),
    );
    await expect(service.createFractional('u1', { propertyId: 'p1', shares: '1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.property.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed when property is missing before transaction', async () => {
    prisma.property.findFirst.mockResolvedValue(null);
    await expect(service.createFractional('u1', { propertyId: 'p1', shares: '1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
