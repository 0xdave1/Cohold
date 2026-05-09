import { Currency, KycStatus, LedgerOperationType, TransactionDirection, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { PaymentService } from './payment.service';
import { WalletService, PLATFORM_USER_ID } from '../wallet/wallet.service';
import { KycPolicyService } from '../kyc/kyc-policy.service';

describe('PaymentService verified Flutterwave funding (Issue 1)', () => {
  const kycPolicy: Pick<KycPolicyService, 'assertFromUserSnapshot' | 'assertUserKycVerifiedForMoneyMovement'> = {
    assertFromUserSnapshot: jest.fn(),
    assertUserKycVerifiedForMoneyMovement: jest.fn(),
  };

  it('processWalletFunding posts double-entry with provider metadata (not user top-up DTO)', async () => {
    const postDoubleEntry = jest.fn().mockResolvedValue({
      legs: [
        { id: 't1', createdAt: new Date(), updatedAt: new Date() },
        { id: 't2', createdAt: new Date(), updatedAt: new Date() },
      ],
      created: true,
    });
    const getPlatformWallet = jest.fn().mockResolvedValue({ id: 'platform-w' });
    const walletService = { postDoubleEntry, getPlatformWallet } as unknown as WalletService;

    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
      },
      wallet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'user-w' })
          .mockResolvedValueOnce({ id: 'user-w' }),
        create: jest.fn(),
      },
    };

    const service = new PaymentService(
      {} as never,
      walletService,
      {} as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    const result = await service.processWalletFunding(tx as never, {
      userId: 'user-1',
      amount: new Decimal('100.00'),
      reference: 'flw_wallet_verified-ref-xyz',
      providerTransactionId: 'flw-tx-999',
    });

    expect(result.didCredit).toBe(true);
    expect(postDoubleEntry).toHaveBeenCalledWith(
      tx,
      'flw_wallet_verified-ref-xyz',
      expect.arrayContaining([
        expect.objectContaining({
          walletId: 'platform-w',
          userId: PLATFORM_USER_ID,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.DEBIT,
          amount: expect.any(Decimal),
          currency: Currency.NGN,
          metadata: expect.objectContaining({
            provider: 'flutterwave',
            reason: 'flutterwave_wallet_funding',
          }),
        }),
        expect.objectContaining({
          walletId: 'user-w',
          userId: 'user-1',
          direction: TransactionDirection.CREDIT,
          metadata: expect.objectContaining({
            provider: 'flutterwave',
            reason: 'flutterwave_wallet_funding',
          }),
        }),
      ]),
      expect.objectContaining({
        operationType: LedgerOperationType.WALLET_FUNDING,
        sourceModule: 'payment.processWalletFunding',
        sourceId: 'flw_wallet_verified-ref-xyz',
      }),
    );
  });

  it('processWalletFunding is idempotent when postDoubleEntry reports no new rows', async () => {
    const postDoubleEntry = jest.fn().mockResolvedValue({
      legs: [
        { id: 't1', createdAt: new Date(), updatedAt: new Date() },
        { id: 't2', createdAt: new Date(), updatedAt: new Date() },
      ],
      created: false,
    });
    const walletService = {
      postDoubleEntry,
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;

    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
      },
      wallet: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'user-w' })
          .mockResolvedValueOnce({ id: 'user-w' }),
        create: jest.fn(),
      },
    };

    const service = new PaymentService(
      {} as never,
      walletService,
      {} as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );
    const result = await service.processWalletFunding(tx as never, {
      userId: 'user-1',
      amount: new Decimal('50'),
      reference: 'same-ref',
    });

    expect(result.didCredit).toBe(false);
    expect(postDoubleEntry).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentService virtual-account webhook funding (Issue 6)', () => {
  it('verifies provider transaction and credits matched virtual account once', async () => {
    const walletService = {
      postDoubleEntry: jest.fn().mockResolvedValue({ legs: [], created: true }),
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;

    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'user-wallet' }) },
    };
    const prisma = { $transaction: jest.fn(async (cb: any) => cb(tx)) } as any;
    const flutterwave = {
      verifyTransactionById: jest.fn().mockResolvedValue({
        txId: 'tx-1',
        reference: 'flw-ref-1',
        amount: new Decimal('1200'),
        status: 'successful',
        currency: 'NGN',
        accountNumber: '0123456789',
      }),
    } as any;
    const virtualAccounts = {
      getActiveAccountByNumber: jest.fn().mockResolvedValue({ id: 'va-1', userId: 'user-1' }),
      upsertDepositEvent: jest.fn(),
    } as any;
    const service = new PaymentService(
      prisma,
      walletService,
      flutterwave,
      { notifyWalletFundedInTransaction: jest.fn() } as any,
      { assertFromUserSnapshot: jest.fn() } as any,
      virtualAccounts,
    );

    await service.handleFlutterwaveWebhook({
      event: 'charge.completed',
      data: { status: 'successful', id: 99, account_number: '0123456789' },
    });

    expect(flutterwave.verifyTransactionById).toHaveBeenCalledWith('99');
    expect(walletService.postDoubleEntry).toHaveBeenCalled();
    expect(virtualAccounts.upsertDepositEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CREDITED', userId: 'user-1', virtualAccountId: 'va-1' }),
    );
  });

  it('does not credit unknown account; records unmatched deposit', async () => {
    const prisma = { $transaction: jest.fn() } as any;
    const service = new PaymentService(
      prisma,
      {} as any,
      {
        verifyTransactionById: jest.fn().mockResolvedValue({
          txId: 'tx-1',
          reference: 'flw-ref-1',
          amount: new Decimal('1200'),
          status: 'successful',
          currency: 'NGN',
          accountNumber: '0000000000',
        }),
      } as any,
      {} as any,
      { assertFromUserSnapshot: jest.fn() } as any,
      {
        getActiveAccountByNumber: jest.fn().mockResolvedValue(null),
        upsertDepositEvent: jest.fn(),
      } as any,
    );
    await service.handleFlutterwaveWebhook({
      event: 'charge.completed',
      data: { status: 'successful', id: 99, account_number: '0000000000' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('duplicate ledger reference does not double-credit', async () => {
    const walletService = {
      postDoubleEntry: jest.fn().mockResolvedValue({ legs: [], created: false }),
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'user-wallet' }) },
    };
    const service = new PaymentService(
      { $transaction: jest.fn(async (cb: any) => cb(tx)) } as any,
      walletService,
      {
        verifyTransactionById: jest.fn().mockResolvedValue({
          txId: 'tx-dup',
          reference: 'flw-ref-dup',
          amount: new Decimal('100'),
          status: 'successful',
          currency: 'NGN',
          accountNumber: '0123456789',
        }),
      } as any,
      { notifyWalletFundedInTransaction: jest.fn() } as any,
      { assertFromUserSnapshot: jest.fn() } as any,
      {
        getActiveAccountByNumber: jest.fn().mockResolvedValue({ id: 'va-1', userId: 'user-1' }),
        upsertDepositEvent: jest.fn(),
      } as any,
    );

    await service.handleFlutterwaveWebhook({
      event: 'charge.completed',
      data: { status: 'successful', id: 11, account_number: '0123456789' },
    });

    expect(walletService.postDoubleEntry).toHaveBeenCalledTimes(1);
    expect(walletService.postDoubleEntry).toHaveBeenCalledWith(
      expect.anything(),
      'FLW_VA_DEPOSIT:tx-dup',
      expect.any(Array),
      expect.any(Object),
    );
  });
});

describe('PaymentService outbox durability', () => {
  it('enqueues wallet-funded notification in same DB transaction', async () => {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }) },
      wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }) },
    };
    const notifyWalletFundedInTransaction = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'u@example.com', isFrozen: false, kycStatus: KycStatus.VERIFIED }) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any;
    const service = new PaymentService(
      prisma,
      {
        postDoubleEntry: jest.fn().mockResolvedValue({ legs: [], created: true }),
        getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
      } as any,
      {
        verifyPayment: jest.fn().mockResolvedValue({
          amount: new Decimal('100'),
          customerEmail: 'u@example.com',
          meta: { type: 'wallet_funding', userId: 'u1' },
          txId: 'tx-1',
        }),
      } as any,
      { notifyWalletFundedInTransaction } as any,
      { assertFromUserSnapshot: jest.fn() } as any,
      {} as any,
    );

    await service.verifyWalletFunding('u1', 'flw_wallet_u1|abc');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(notifyWalletFundedInTransaction).toHaveBeenCalledWith(
      tx,
      'u1',
      '100.00',
      'NGN',
      'flw_wallet_u1|abc',
    );
  });
});
