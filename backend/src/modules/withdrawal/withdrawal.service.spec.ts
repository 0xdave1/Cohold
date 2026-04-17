import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Currency, KycStatus, WithdrawalStatus } from '@prisma/client';

describe('WithdrawalService', () => {
  let service: WithdrawalService;

  const authService = {
    verifyTransactionOtpForUser: jest.fn(),
  };

  const notificationsService = {
    notifyWithdrawalInitiated: jest.fn(),
    notifyWithdrawalCompleted: jest.fn(),
    notifyWithdrawalFailed: jest.fn(),
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
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transaction: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(WithdrawalService);
  });

  const userId = 'user-1';
  const bankId = 'bank-1';
  const walletId = 'wallet-1';

  it('rejects invalid OTP before touching wallet', async () => {
    authService.verifyTransactionOtpForUser.mockRejectedValue(new UnauthorizedException('Invalid or expired OTP'));

    await expect(
      service.createWithdrawal(userId, {
        linkedBankAccountId: bankId,
        amount: '100.0000',
        currency: 'NGN',
        otp: '000000',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when KYC not verified', async () => {
    authService.verifyTransactionOtpForUser.mockResolvedValue(undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      isFrozen: false,
      kycStatus: KycStatus.PENDING,
    });

    await expect(
      service.createWithdrawal(userId, {
        linkedBankAccountId: bankId,
        amount: '50',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-owned linked bank', async () => {
    authService.verifyTransactionOtpForUser.mockResolvedValue(undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      isFrozen: false,
      kycStatus: KycStatus.VERIFIED,
    });
    prismaMock.linkedBankAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.createWithdrawal(userId, {
        linkedBankAccountId: bankId,
        amount: '50',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects insufficient balance inside locked transaction', async () => {
    authService.verifyTransactionOtpForUser.mockResolvedValue(undefined);
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
      bankName: 'Test Bank',
      accountName: 'Jane Doe',
      bankCode: '058',
    });
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: walletId,
      userId,
      currency: Currency.NGN,
      balance: { toString: () => '10.0000' },
    });

    const tx = {
      $queryRawUnsafe: jest.fn(),
      wallet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: walletId,
          balance: { toString: () => '10.0000' },
        }),
        update: jest.fn(),
      },
      withdrawal: { create: jest.fn() },
      transaction: { create: jest.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    await expect(
      service.createWithdrawal(userId, {
        linkedBankAccountId: bankId,
        amount: '100',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.withdrawal.create).not.toHaveBeenCalled();
  });

  it('creates PENDING withdrawal, debits wallet, and writes ledger in one transaction', async () => {
    authService.verifyTransactionOtpForUser.mockResolvedValue(undefined);
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
      bankName: 'Test Bank',
      accountName: 'Jane Doe',
      bankCode: '058',
    });
    prismaMock.wallet.findUnique.mockResolvedValue({
      id: walletId,
      userId,
      currency: Currency.NGN,
      balance: { toString: () => '500.0000' },
    });

    const createdWd = {
      id: 'wd-1',
      userId,
      walletId,
      linkedBankAccountId: bankId,
      reference: 'WD-testref',
      amount: { toString: () => '100.0000' },
      fee: { toString: () => '0.0000' },
      netAmount: { toString: () => '100.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PENDING,
      failureReason: null,
      initiatedAt: new Date(),
      processedAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue(undefined),
      wallet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: walletId,
          balance: { toString: () => '500.0000' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      withdrawal: {
        create: jest.fn().mockResolvedValue(createdWd),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await service.createWithdrawal(userId, {
      linkedBankAccountId: bankId,
      amount: '100',
      currency: 'NGN',
      otp: '123456',
    });

    expect(tx.wallet.update).toHaveBeenCalled();
    expect(tx.withdrawal.create).toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalled();
    expect(result.status).toBe(WithdrawalStatus.PENDING);
    expect(notificationsService.notifyWithdrawalInitiated).toHaveBeenCalled();
  });

  it('markFailed reverses balance and marks FAILED', async () => {
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({
        id: 'wd-1',
        userId,
        walletId,
        amount: { toString: () => '100.0000' },
        currency: Currency.NGN,
        status: WithdrawalStatus.PENDING,
        reference: 'WD-r',
      })
      .mockResolvedValueOnce({
        id: 'wd-1',
        status: WithdrawalStatus.FAILED,
      });

    const tx = {
      withdrawal: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wd-1',
          status: WithdrawalStatus.PENDING,
        }),
        update: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      wallet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: walletId,
          balance: { toString: () => '400.0000' },
        }),
        update: jest.fn(),
      },
      transaction: { create: jest.fn() },
    };

    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValue({ id: 'wd-1', status: WithdrawalStatus.FAILED });

    await service.markFailed('wd-1', 'Payout provider error');

    expect(tx.wallet.update).toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalled();
    expect(tx.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WithdrawalStatus.FAILED }),
      }),
    );
    expect(notificationsService.notifyWithdrawalFailed).toHaveBeenCalled();
  });
});
