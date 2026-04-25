import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Currency, KycStatus, WithdrawalStatus } from '@prisma/client';
import { WithdrawalService } from './withdrawal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';

describe('WithdrawalService payout orchestration', () => {
  let service: WithdrawalService;

  const authService = {
    verifyTransactionOtpForUser: jest.fn(),
  };
  const notificationsService = {
    notifyWithdrawalInitiated: jest.fn(),
    notifyWithdrawalCompleted: jest.fn(),
    notifyWithdrawalFailed: jest.fn(),
  };
  const payoutProvider = {
    initiateTransfer: jest.fn(),
    parseTransferWebhook: jest.fn(),
  };

  const prismaMock = {
    user: { findUnique: jest.fn() },
    linkedBankAccount: { findFirst: jest.fn() },
    wallet: { findUnique: jest.fn() },
    withdrawal: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    transaction: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PAYOUT_PROVIDER, useValue: payoutProvider },
      ],
    }).compile();
    service = module.get(WithdrawalService);
  });

  const userId = 'u1';
  const bankId = 'b1';
  const walletId = 'w1';

  function primeHappyPath() {
    prismaMock.withdrawal.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    prismaMock.linkedBankAccount.findFirst.mockResolvedValue({
      id: bankId,
      userId,
      currency: Currency.NGN,
      accountNumber: '0123456789',
      bankName: 'GTBank',
      accountName: 'John Doe',
      bankCode: '058',
      isVerified: true,
    });
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: walletId,
      userId,
      currency: Currency.NGN,
      balance: { toString: () => '500.0000' },
    });
  }

  it('marks PROCESSING when provider accepts transfer initiation', async () => {
    payoutProvider.initiateTransfer.mockResolvedValue({
      accepted: true,
      providerReference: 'WD-ref-1',
      transferCode: 'tr-1',
      status: 'PROCESSING',
      rawStatus: 'new',
      failureReason: null,
    });

    const pending = {
      id: 'wd-1',
      userId,
      walletId,
      linkedBankAccountId: bankId,
      reference: 'WD-ref-1',
      amount: { toString: () => '100.0000' },
      fee: { toString: () => '0.0000' },
      netAmount: { toString: () => '100.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PENDING,
      failureReason: null,
      providerReference: null,
      providerTransferCode: null,
      initiatedAt: new Date(),
      processedAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const processing = {
      ...pending,
      status: WithdrawalStatus.PROCESSING,
      processedAt: new Date(),
      providerTransferCode: 'tr-1',
      providerReference: 'WD-ref-1',
    };
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({
        ...pending,
        linkedBankAccount: {
          accountNumber: '0123456789',
          bankCode: '058',
          accountName: 'John Doe',
          isVerified: true,
        },
      })
      .mockResolvedValueOnce(pending);
    prismaMock.withdrawal.update.mockResolvedValue(processing);

    const result = await service.initiatePayoutForWithdrawal('wd-1');

    expect(payoutProvider.initiateTransfer).toHaveBeenCalled();
    expect((result as any).status).toBe(WithdrawalStatus.PROCESSING);
  });

  it('marks FAILED and reverses when provider rejects transfer', async () => {
    payoutProvider.initiateTransfer.mockResolvedValue({
      accepted: false,
      providerReference: 'WD-ref-2',
      transferCode: null,
      status: 'FAILED',
      rawStatus: 'failed',
      failureReason: 'Account restricted',
    });

    const created = {
      id: 'wd-2',
      userId,
      walletId,
      linkedBankAccountId: bankId,
      reference: 'WD-ref-2',
      amount: { toString: () => '100.0000' },
      fee: { toString: () => '0.0000' },
      netAmount: { toString: () => '100.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PENDING,
      failureReason: null,
      providerReference: null,
      providerTransferCode: null,
      initiatedAt: new Date(),
      processedAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        withdrawal: {
          findUnique: jest.fn().mockResolvedValue({ ...created, status: WithdrawalStatus.PENDING }),
          update: jest.fn().mockResolvedValue({ ...created, status: WithdrawalStatus.FAILED }),
        },
        wallet: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: walletId, balance: { toString: () => '400.0000' } }),
          update: jest.fn().mockResolvedValue({}),
        },
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue(undefined),
      };
      return fn(tx);
    });
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({
        ...created,
        status: WithdrawalStatus.PENDING,
        linkedBankAccount: {
          accountNumber: '0123456789',
          bankCode: '058',
          accountName: 'John Doe',
          isVerified: true,
        },
      })
      .mockResolvedValueOnce({ ...created, status: WithdrawalStatus.PENDING })
      .mockResolvedValueOnce({ ...created, status: WithdrawalStatus.FAILED });
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValue({ ...created, status: WithdrawalStatus.FAILED });

    const result = await service.initiatePayoutForWithdrawal('wd-2');
    expect(result.status).toBe(WithdrawalStatus.FAILED);
    expect(notificationsService.notifyWithdrawalFailed).toHaveBeenCalled();
  });

  it('webhook success marks COMPLETED', async () => {
    payoutProvider.parseTransferWebhook.mockReturnValue({
      eventType: 'transfer.completed',
      providerReference: 'WD-ref-3',
      transferCode: 'tr-3',
      status: 'SUCCESS',
      failureReason: null,
    });
    prismaMock.withdrawal.findFirst.mockResolvedValue({
      id: 'wd-3',
      userId,
      walletId,
      reference: 'WD-ref-3',
      amount: { toString: () => '50.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PROCESSING,
      linkedBankAccountId: bankId,
      fee: { toString: () => '0.0000' },
      netAmount: { toString: () => '50.0000' },
      failureReason: null,
      initiatedAt: new Date(),
      processedAt: new Date(),
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd-3',
      userId,
      amount: { toString: () => '50.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PROCESSING,
    });
    prismaMock.withdrawal.update.mockResolvedValue({ id: 'wd-3', status: WithdrawalStatus.COMPLETED });

    await service.handlePayoutWebhook({ event: 'transfer.completed' });
    expect(prismaMock.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: WithdrawalStatus.COMPLETED }) }),
    );
  });

  it('duplicate webhook failure does not double reverse', async () => {
    payoutProvider.parseTransferWebhook.mockReturnValue({
      eventType: 'transfer.failed',
      providerReference: 'WD-ref-4',
      transferCode: 'tr-4',
      status: 'FAILED',
      failureReason: 'Declined',
    });
    prismaMock.withdrawal.findFirst.mockResolvedValue({
      id: 'wd-4',
      userId,
      walletId,
      reference: 'WD-ref-4',
      amount: { toString: () => '50.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.FAILED,
      linkedBankAccountId: bankId,
      fee: { toString: () => '0.0000' },
      netAmount: { toString: () => '50.0000' },
      failureReason: 'Declined',
      initiatedAt: new Date(),
      processedAt: new Date(),
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd-4',
      status: WithdrawalStatus.FAILED,
    });

    await service.handlePayoutWebhook({ event: 'transfer.failed' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('invalid OTP still blocks withdrawal before debit', async () => {
    primeHappyPath();
    authService.verifyTransactionOtpForUser.mockRejectedValue(new UnauthorizedException('Invalid OTP'));
    await expect(
      service.createWithdrawal(userId, {
        idempotencyKey: 'idem-otp',
        linkedBankAccountId: bankId,
        amount: '100',
        currency: 'NGN',
        otp: '000000',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('requires verified linked bank account before payout', async () => {
    primeHappyPath();
    prismaMock.linkedBankAccount.findFirst.mockResolvedValueOnce({
      id: bankId,
      userId,
      currency: Currency.NGN,
      accountNumber: '0123456789',
      bankName: 'GTBank',
      accountName: 'John Doe',
      bankCode: null,
      isVerified: false,
    });
    await expect(
      service.createWithdrawal(userId, {
        idempotencyKey: 'idem-unverified-bank',
        linkedBankAccountId: bankId,
        amount: '100',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
