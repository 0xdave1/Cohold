import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Currency, KycStatus, LedgerOperationType, WithdrawalStatus } from '@prisma/client';
import { WithdrawalService } from './withdrawal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYOUT_PROVIDER } from '../payout/payout-provider.interface';
import { WalletService } from '../wallet/wallet.service';
import { KycPolicyService } from '../kyc/kyc-policy.service';

describe('WithdrawalService payout orchestration', () => {
  let service: WithdrawalService;

  const walletService = {
    getPayoutWallet: jest.fn().mockResolvedValue({ id: 'payout-wallet-1' }),
    postDoubleEntry: jest.fn().mockResolvedValue({ legs: [], created: true }),
  };

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
    getTransferStatus: jest.fn(),
  };

  const kycPolicy = {
    assertFromUserSnapshot: jest.fn((u: { isFrozen: boolean; kycStatus: KycStatus }) => {
      if (u.isFrozen) {
        throw new ForbiddenException({ code: 'ACCOUNT_FROZEN', message: 'Account is disabled' });
      }
      if (u.kycStatus !== KycStatus.VERIFIED) {
        throw new ForbiddenException({ code: 'KYC_REQUIRED', message: 'Verified KYC is required' });
      }
    }),
    assertUserKycVerifiedForMoneyMovement: jest.fn(),
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
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    transaction: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    kycPolicy.assertFromUserSnapshot.mockImplementation((u: { isFrozen: boolean; kycStatus: KycStatus }) => {
      if (u.isFrozen) {
        throw new ForbiddenException({ code: 'ACCOUNT_FROZEN', message: 'Account is disabled' });
      }
      if (u.kycStatus !== KycStatus.VERIFIED) {
        throw new ForbiddenException({ code: 'KYC_REQUIRED', message: 'Verified KYC is required' });
      }
    });
    walletService.getPayoutWallet.mockResolvedValue({ id: 'payout-wallet-1' });
    walletService.postDoubleEntry.mockResolvedValue({ legs: [], created: true });
    payoutProvider.getTransferStatus.mockResolvedValue({
      status: 'PROCESSING',
      providerReference: 'WD-ref',
      transferCode: 'tr-x',
      rawStatus: 'NEW',
      failureReason: null,
    });
    const module = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WalletService, useValue: walletService },
        { provide: KycPolicyService, useValue: kycPolicy },
        { provide: PAYOUT_PROVIDER, useValue: payoutProvider },
      ],
    }).compile();
    service = module.get(WithdrawalService);
  });

  const userId = 'u1';
  const bankId = 'b1';
  const walletId = 'w1';

  const linkedBank = {
    accountNumber: '0123456789',
    bankCode: '058',
    accountName: 'John Doe',
    isVerified: true,
  };

  function baseWithdrawal(over: Partial<Record<string, unknown>> = {}) {
    return {
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
      providerStatus: null,
      providerLastCheckedAt: null,
      reconciliationConflict: false,
      reconciliationConflictReason: null,
      reconciliationConflictAt: null,
      initiatedAt: new Date(),
      processedAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    };
  }

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
      ambiguous: false,
    });

    const pending = baseWithdrawal({ id: 'wd-1', reference: 'WD-ref-1' });
    const initiating = { ...pending, status: WithdrawalStatus.INITIATING };
    const processing = {
      ...pending,
      status: WithdrawalStatus.PROCESSING,
      processedAt: new Date(),
      providerTransferCode: 'tr-1',
      providerReference: 'WD-ref-1',
    };

    prismaMock.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ ...pending, linkedBankAccount: linkedBank })
      .mockResolvedValueOnce({ ...initiating })
      .mockResolvedValue({ ...initiating });
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValueOnce({
      ...initiating,
      linkedBankAccount: linkedBank,
    });
    prismaMock.withdrawal.update.mockResolvedValue(processing);

    const result = await service.initiatePayoutForWithdrawal('wd-1');

    expect(prismaMock.withdrawal.updateMany).toHaveBeenCalled();
    expect(payoutProvider.initiateTransfer).toHaveBeenCalledTimes(1);
    expect((result as { status: WithdrawalStatus }).status).toBe(WithdrawalStatus.PROCESSING);
  });

  it('second concurrent claim does not call Flutterwave', async () => {
    payoutProvider.initiateTransfer.mockResolvedValue({
      accepted: true,
      providerReference: 'WD-ref-1',
      transferCode: 'tr-1',
      status: 'PROCESSING',
      ambiguous: false,
    });

    const pending = baseWithdrawal();
    const initiatingWinner = { ...pending, status: WithdrawalStatus.INITIATING };
    const processingWinner = {
      ...pending,
      status: WithdrawalStatus.PROCESSING,
      providerTransferCode: 'tr-1',
      providerReference: 'WD-ref-1',
    };

    prismaMock.withdrawal.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ ...pending, linkedBankAccount: linkedBank })
      .mockResolvedValueOnce({ ...initiatingWinner, linkedBankAccount: linkedBank })
      .mockResolvedValueOnce({ ...processingWinner, linkedBankAccount: linkedBank });
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValueOnce({
      ...initiatingWinner,
      linkedBankAccount: linkedBank,
    });
    prismaMock.withdrawal.update.mockResolvedValue(processingWinner);

    await service.initiatePayoutForWithdrawal('wd-1');
    await service.initiatePayoutForWithdrawal('wd-1');

    expect(payoutProvider.initiateTransfer).toHaveBeenCalledTimes(1);
  });

  it('marks FAILED and reverses when provider rejects transfer', async () => {
    payoutProvider.initiateTransfer.mockResolvedValue({
      accepted: false,
      providerReference: 'WD-ref-2',
      transferCode: null,
      status: 'FAILED',
      rawStatus: 'failed',
      failureReason: 'Account restricted',
      ambiguous: false,
    });

    const created = baseWithdrawal({
      id: 'wd-2',
      reference: 'WD-ref-2',
    });
    const initiating = { ...created, status: WithdrawalStatus.INITIATING };

    prismaMock.withdrawal.updateMany.mockResolvedValue({ count: 1 });

    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        withdrawal: {
          findUnique: jest.fn().mockResolvedValue({ ...initiating }),
          update: jest.fn().mockResolvedValue({ ...created, status: WithdrawalStatus.FAILED }),
        },
        transaction: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        wallet: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: walletId, balance: { toString: () => '400.0000' } }),
          update: jest.fn().mockResolvedValue({}),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue(undefined),
      };
      return fn(tx);
    });
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ ...created, linkedBankAccount: linkedBank })
      .mockResolvedValueOnce({ ...initiating })
      .mockResolvedValue({ ...initiating });
    prismaMock.withdrawal.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...initiating,
        linkedBankAccount: linkedBank,
      })
      .mockResolvedValue({ ...created, status: WithdrawalStatus.FAILED });

    const result = await service.initiatePayoutForWithdrawal('wd-2');
    expect(result.status).toBe(WithdrawalStatus.FAILED);
    expect(notificationsService.notifyWithdrawalFailed).toHaveBeenCalled();
    expect(walletService.postDoubleEntry).toHaveBeenCalledWith(
      expect.anything(),
      'WITHDRAWAL_REVERSAL:wd-2',
      expect.any(Array),
      expect.objectContaining({ operationType: LedgerOperationType.WITHDRAWAL_REVERSAL }),
    );
  });

  it('ambiguous initiation moves to RECONCILIATION_REQUIRED without reversal', async () => {
    payoutProvider.initiateTransfer.mockResolvedValue({
      accepted: false,
      providerReference: 'WD-ref-a',
      transferCode: null,
      status: 'UNKNOWN',
      ambiguous: true,
      failureReason: 'timeout',
    });
    const created = baseWithdrawal({ id: 'wd-a', reference: 'WD-ref-a' });
    const initiating = { ...created, status: WithdrawalStatus.INITIATING };
    prismaMock.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.withdrawal.findUnique
      .mockResolvedValueOnce({ ...created, linkedBankAccount: linkedBank })
      .mockResolvedValueOnce({ ...initiating });
    prismaMock.withdrawal.findUniqueOrThrow.mockResolvedValueOnce({
      ...initiating,
      linkedBankAccount: linkedBank,
    });
    prismaMock.withdrawal.update.mockResolvedValue({
      ...created,
      status: WithdrawalStatus.RECONCILIATION_REQUIRED,
    });

    const result = await service.initiatePayoutForWithdrawal('wd-a');
    expect(result.status).toBe(WithdrawalStatus.RECONCILIATION_REQUIRED);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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
      ...baseWithdrawal({
        id: 'wd-3',
        reference: 'WD-ref-3',
        amount: { toString: () => '50.0000' },
        netAmount: { toString: () => '50.0000' },
        status: WithdrawalStatus.PROCESSING,
      }),
      linkedBankAccountId: bankId,
    });
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd-3',
      userId,
      amount: { toString: () => '50.0000' },
      currency: Currency.NGN,
      status: WithdrawalStatus.PROCESSING,
      reference: 'WD-ref-3',
      metadata: {},
      processedAt: new Date(),
    });
    prismaMock.withdrawal.update.mockResolvedValue({ id: 'wd-3', status: WithdrawalStatus.COMPLETED });

    await service.handlePayoutWebhook({ event: 'transfer.completed' });
    expect(prismaMock.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: WithdrawalStatus.COMPLETED }) }),
    );
  });

  it('duplicate webhook SUCCESS is idempotent', async () => {
    payoutProvider.parseTransferWebhook.mockReturnValue({
      eventType: 'transfer.completed',
      providerReference: 'WD-ref-dup',
      transferCode: 'tr-d',
      status: 'SUCCESS',
      failureReason: null,
    });
    prismaMock.withdrawal.findFirst.mockResolvedValue({
      ...baseWithdrawal({ id: 'wd-d', reference: 'WD-ref-dup', status: WithdrawalStatus.COMPLETED }),
      linkedBankAccountId: bankId,
    });
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      id: 'wd-d',
      status: WithdrawalStatus.COMPLETED,
      reference: 'WD-ref-dup',
      metadata: {},
    });

    await service.handlePayoutWebhook({ event: 'transfer.completed' });
    expect(prismaMock.withdrawal.update).not.toHaveBeenCalled();
  });

  const LATE_SUCCESS_REVERSAL_CONFLICT_REASON =
    'Provider confirmed SUCCESS after local failure/reversal. Possible bank-paid + wallet-refunded conflict.';

  it('FAILED withdrawal with reversal legs: SUCCESS webhook persists reconciliation conflict', async () => {
    payoutProvider.parseTransferWebhook.mockReturnValue({
      eventType: 'transfer.completed',
      providerReference: 'WD-ref-late',
      transferCode: 'tr-l',
      status: 'SUCCESS',
      failureReason: null,
    });
    prismaMock.transaction.count.mockResolvedValue(2);
    prismaMock.withdrawal.findFirst.mockResolvedValue({
      ...baseWithdrawal({
        id: 'wd-late',
        reference: 'WD-ref-late',
        status: WithdrawalStatus.FAILED,
        failureReason: 'was wrong',
      }),
      linkedBankAccountId: bankId,
    });
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd-late',
      userId,
      reference: 'WD-ref-late',
      amount: { toString: () => '10' },
      currency: Currency.NGN,
      status: WithdrawalStatus.FAILED,
      metadata: {},
      processedAt: new Date(),
    });
    prismaMock.withdrawal.update.mockResolvedValue({
      id: 'wd-late',
      status: WithdrawalStatus.RECONCILIATION_REQUIRED,
      reconciliationConflict: true,
    });

    await service.handlePayoutWebhook({ event: 'transfer.completed' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(notificationsService.notifyWithdrawalCompleted).not.toHaveBeenCalled();
    expect(prismaMock.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WithdrawalStatus.RECONCILIATION_REQUIRED,
          reconciliationConflict: true,
          reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
          reconciliationConflictAt: expect.any(Date),
          completedAt: null,
          providerStatus: 'SUCCESSFUL',
          providerReference: 'WD-ref-late',
          providerTransferCode: 'tr-l',
          providerLastCheckedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('FAILED withdrawal with reversal legs: poll SUCCESS persists reconciliation conflict', async () => {
    prismaMock.transaction.count.mockResolvedValue(2);
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      ...baseWithdrawal({
        id: 'wd-poll',
        status: WithdrawalStatus.FAILED,
        providerTransferCode: 'tr-poll',
        providerReference: 'WD-ref-poll',
      }),
    });
    payoutProvider.getTransferStatus.mockResolvedValue({
      status: 'SUCCESS',
      providerReference: 'WD-ref-poll',
      transferCode: 'tr-poll',
      rawStatus: 'SUCCESSFUL',
      failureReason: null,
    });
    prismaMock.withdrawal.update.mockResolvedValue({
      id: 'wd-poll',
      status: WithdrawalStatus.RECONCILIATION_REQUIRED,
    });

    await service.reconcileWithdrawalById('wd-poll');
    expect(payoutProvider.getTransferStatus).toHaveBeenCalledWith('tr-poll');
    expect(notificationsService.notifyWithdrawalCompleted).not.toHaveBeenCalled();
    expect(prismaMock.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WithdrawalStatus.RECONCILIATION_REQUIRED,
          reconciliationConflict: true,
          reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
        }),
      }),
    );
  });

  it('duplicate SUCCESS webhook after conflict only refreshes provider fields', async () => {
    payoutProvider.parseTransferWebhook.mockReturnValue({
      eventType: 'transfer.completed',
      providerReference: 'WD-ref-dup2',
      transferCode: 'tr-d2',
      status: 'SUCCESS',
      failureReason: null,
    });
    const conflictRow = {
      ...baseWithdrawal({
        id: 'wd-dup2',
        reference: 'WD-ref-dup2',
        status: WithdrawalStatus.RECONCILIATION_REQUIRED,
        reconciliationConflict: true,
        reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
        reconciliationConflictAt: new Date(),
        providerReference: 'old-pr',
        providerTransferCode: 'tr-d2',
      }),
      linkedBankAccountId: bankId,
    };
    prismaMock.withdrawal.findFirst.mockResolvedValue(conflictRow);
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      ...conflictRow,
      userId,
      amount: { toString: () => '10' },
      currency: Currency.NGN,
      metadata: {},
      processedAt: new Date(),
    });
    prismaMock.withdrawal.update.mockResolvedValue(conflictRow);

    await service.handlePayoutWebhook({ event: 'transfer.completed' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.withdrawal.update).toHaveBeenCalledTimes(1);
    const updateData = prismaMock.withdrawal.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData).toMatchObject({
      providerStatus: 'SUCCESSFUL',
      providerLastCheckedAt: expect.any(Date),
    });
    expect(updateData).not.toHaveProperty('reconciliationConflict');
    expect(updateData).not.toHaveProperty('reconciliationConflictReason');
    expect(updateData).not.toHaveProperty('reconciliationConflictAt');
  });

  it('adminListWithdrawals exposes reconciliation and provider fields', async () => {
    const at = new Date();
    prismaMock.withdrawal.findMany.mockResolvedValue([
      {
        id: 'wd-a',
        userId,
        reference: 'r1',
        amount: { toString: () => '1' },
        currency: Currency.NGN,
        status: WithdrawalStatus.RECONCILIATION_REQUIRED,
        failureReason: null,
        providerReference: 'p1',
        providerTransferCode: 't1',
        providerStatus: 'SUCCESSFUL',
        providerLastCheckedAt: at,
        reconciliationConflict: true,
        reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
        reconciliationConflictAt: at,
        initiatedAt: at,
        processedAt: at,
        completedAt: null,
        updatedAt: at,
        linkedBankAccountId: bankId,
      },
    ]);
    prismaMock.withdrawal.count.mockResolvedValue(1);

    const out = await service.adminListWithdrawals({ page: 1, limit: 20 });
    expect(out.items[0]).toMatchObject({
      reconciliationConflict: true,
      reconciliationConflictReason: LATE_SUCCESS_REVERSAL_CONFLICT_REASON,
      reconciliationConflictAt: at,
      providerStatus: 'SUCCESSFUL',
      providerLastCheckedAt: at,
    });
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
      ...baseWithdrawal({
        id: 'wd-4',
        reference: 'WD-ref-4',
        status: WithdrawalStatus.FAILED,
        failureReason: 'Declined',
        amount: { toString: () => '50.0000' },
        netAmount: { toString: () => '50.0000' },
      }),
      linkedBankAccountId: bankId,
    });
    prismaMock.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd-4',
      status: WithdrawalStatus.FAILED,
    });

    await service.handlePayoutWebhook({ event: 'transfer.failed' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reconcileWithdrawalById uses provider poll SUCCESS', async () => {
    prismaMock.withdrawal.findUnique.mockResolvedValue({
      ...baseWithdrawal({
        id: 'wd-r',
        status: WithdrawalStatus.PROCESSING,
        providerTransferCode: '999',
      }),
    });
    payoutProvider.getTransferStatus.mockResolvedValue({
      status: 'SUCCESS',
      providerReference: 'WD-ref-r',
      transferCode: '999',
      rawStatus: 'SUCCESSFUL',
      failureReason: null,
    });
    prismaMock.withdrawal.update.mockResolvedValue({
      id: 'wd-r',
      status: WithdrawalStatus.COMPLETED,
    });

    await service.reconcileWithdrawalById('wd-r');
    expect(payoutProvider.getTransferStatus).toHaveBeenCalledWith('999');
    expect(prismaMock.withdrawal.update).toHaveBeenCalled();
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

  it('rejects withdrawal without verified KYC', async () => {
    primeHappyPath();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      isFrozen: false,
      kycStatus: KycStatus.PENDING,
    });
    await expect(
      service.createWithdrawal(userId, {
        idempotencyKey: 'idem-kyc',
        linkedBankAccountId: bankId,
        amount: '100',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects withdrawal for frozen user', async () => {
    primeHappyPath();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      isFrozen: true,
      kycStatus: KycStatus.VERIFIED,
    });
    await expect(
      service.createWithdrawal(userId, {
        idempotencyKey: 'idem-frz',
        linkedBankAccountId: bankId,
        amount: '100',
        currency: 'NGN',
        otp: '123456',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
