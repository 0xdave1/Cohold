import { KycStatus, LedgerOperationType, WalletFundingPaymentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PaymentService } from './payment.service';
import { WalletService } from '../wallet/wallet.service';
import { KycPolicyService } from '../kyc/kyc-policy.service';
import { PaystackProvider } from './providers/paystack.provider';

function verifiedCheckout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    reference: 'PSK-WALLET-u1|abc',
    amount: new Decimal('100'),
    amountKobo: 10000,
    currency: 'NGN',
    status: 'success',
    paidAt: null,
    transactionId: '999',
    customerEmail: 'user@example.com',
    metadata: {
      type: 'wallet_funding',
      userId: 'u1',
      expectedAmount: '100.00',
      expectedAmountKobo: 10000,
    },
    channel: 'card',
    accountNumber: null,
    ...overrides,
  };
}

function pendingPayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pay-1',
    userId: 'u1',
    internalReference: 'PSK-WALLET-u1|abc',
    amountNaira: new Prisma.Decimal('100'),
    amountKobo: 10000,
    currency: 'NGN',
    status: WalletFundingPaymentStatus.PENDING,
    ...overrides,
  };
}

describe('PaymentService Paystack wallet funding', () => {
  const kycPolicy: Pick<KycPolicyService, 'assertFromUserSnapshot' | 'assertUserKycVerifiedForMoneyMovement'> = {
    assertFromUserSnapshot: jest.fn(),
    assertUserKycVerifiedForMoneyMovement: jest.fn(),
  };

  it('processWalletFunding posts double-entry with paystack metadata', async () => {
    const postDoubleEntry = jest.fn().mockResolvedValue({
      legs: [
        { id: 't1', createdAt: new Date(), updatedAt: new Date() },
        { id: 't2', createdAt: new Date(), updatedAt: new Date() },
      ],
      created: true,
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
        findUnique: jest.fn().mockResolvedValue({ id: 'user-w' }),
        create: jest.fn(),
      },
    };

    const service = new PaymentService(
      {} as never,
      walletService,
      {} as never,
      { get: jest.fn() } as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    const result = await service.processWalletFunding(tx as never, {
      userId: 'user-1',
      amount: new Decimal('100.00'),
      reference: 'PSK-WALLET-user-1|abc',
      providerTransactionId: 'psk-tx-999',
    });

    expect(result.didCredit).toBe(true);
    expect(postDoubleEntry).toHaveBeenCalledWith(
      tx,
      'PSK-WALLET-user-1|abc',
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            provider: 'paystack',
            reason: 'paystack_wallet_funding',
          }),
        }),
      ]),
      expect.objectContaining({
        operationType: LedgerOperationType.WALLET_FUNDING,
        sourceModule: 'payment.processWalletFunding',
      }),
    );
  });

  it('initializeWalletFunding stores pending payment and sends NGN kobo to Paystack', async () => {
    const paystack = {
      initializeTransaction: jest.fn().mockResolvedValue({
        authorizationUrl: 'https://checkout.paystack.com/x',
        accessCode: 'ac',
        reference: 'PSK-WALLET-u1|ref',
      }),
    } as unknown as PaystackProvider;

    const createPayment = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          isFrozen: false,
          kycStatus: KycStatus.VERIFIED,
        }),
      },
      walletFundingPayment: { create: createPayment },
    };
    const walletService = { postDoubleEntry: jest.fn() } as unknown as WalletService;

    const service = new PaymentService(
      prisma as never,
      walletService,
      paystack,
      { get: jest.fn().mockReturnValue('http://localhost:3000/dashboard/wallet?payment=callback') } as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    const out = await service.initializeWalletFunding({
      amountNaira: '1500.50',
      userId: 'u1',
      email: 'user@example.com',
    });

    expect(out.checkoutUrl).toContain('paystack');
    expect(walletService.postDoubleEntry).not.toHaveBeenCalled();
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountKobo: 150050,
          status: WalletFundingPaymentStatus.PENDING,
        }),
      }),
    );
    const initArg = (paystack.initializeTransaction as jest.Mock).mock.calls[0][0];
    expect(initArg.currency).toBe('NGN');
    expect(initArg.amount.toString()).toBe('1500.5');
    expect(initArg.metadata).toMatchObject({ expectedAmountKobo: 150050 });
  });

  it('verifyWalletFunding credits once; duplicate postDoubleEntry is idempotent', async () => {
    const paystack = {
      verifyTransaction: jest.fn().mockResolvedValue(verifiedCheckout()),
    } as unknown as PaystackProvider;

    const postDoubleEntry = jest
      .fn()
      .mockResolvedValueOnce({ created: true, legs: [{}, {}] })
      .mockResolvedValueOnce({ created: false, legs: [{}, {}] });

    const walletService = {
      postDoubleEntry,
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;

    const paymentUpdate = jest.fn().mockResolvedValue({});
    const txRunner = jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
        },
        wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'user-w' }) },
        walletFundingPayment: { update: paymentUpdate },
      };
      await fn(tx);
    });

    const findPayment = jest
      .fn()
      .mockResolvedValueOnce(pendingPayment())
      .mockResolvedValueOnce(
        pendingPayment({ status: WalletFundingPaymentStatus.COMPLETED }),
      );

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          isFrozen: false,
          kycStatus: KycStatus.VERIFIED,
        }),
      },
      walletFundingPayment: { findUnique: findPayment },
      $transaction: txRunner,
    };

    const notifications = {
      notifyWalletFundedInTransaction: jest.fn(),
    };

    const service = new PaymentService(
      prisma as never,
      walletService,
      paystack,
      { get: jest.fn() } as never,
      notifications as never,
      kycPolicy as never,
      {} as never,
    );

    const first = await service.verifyWalletFunding('u1', 'PSK-WALLET-u1|abc');
    const second = await service.verifyWalletFunding('u1', 'PSK-WALLET-u1|abc');
    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);
    expect(postDoubleEntry).toHaveBeenCalledTimes(1);
    expect(notifications.notifyWalletFundedInTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects amount kobo mismatch against pending payment', async () => {
    const paystack = {
      verifyTransaction: jest.fn().mockResolvedValue(
        verifiedCheckout({ amount: new Decimal('50'), amountKobo: 5000 }),
      ),
    } as unknown as PaystackProvider;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          isFrozen: false,
          kycStatus: KycStatus.VERIFIED,
        }),
      },
      walletFundingPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment()),
      },
    };

    const service = new PaymentService(
      prisma as never,
      {} as never,
      paystack,
      { get: jest.fn() } as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    await expect(service.verifyWalletFunding('u1', 'PSK-WALLET-u1|abc')).rejects.toThrow(
      /amount does not match/i,
    );
  });

  it('rejects currency mismatch', async () => {
    const paystack = {
      verifyTransaction: jest.fn().mockResolvedValue(verifiedCheckout({ currency: 'USD' })),
    } as unknown as PaystackProvider;

    const service = new PaymentService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'user@example.com',
            isFrozen: false,
            kycStatus: KycStatus.VERIFIED,
          }),
        },
        walletFundingPayment: {
          findUnique: jest.fn().mockResolvedValue(pendingPayment()),
        },
      } as never,
      {} as never,
      paystack,
      { get: jest.fn() } as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    await expect(service.verifyWalletFunding('u1', 'PSK-WALLET-u1|abc')).rejects.toThrow(/NGN/i);
  });

  it('marks REQUIRES_RECONCILIATION when ledger post fails after verification', async () => {
    const paystack = {
      verifyTransaction: jest.fn().mockResolvedValue(verifiedCheckout()),
    } as unknown as PaystackProvider;

    const walletService = {
      postDoubleEntry: jest.fn().mockRejectedValue(new Error('ledger down')),
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;

    const paymentUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          isFrozen: false,
          kycStatus: KycStatus.VERIFIED,
        }),
      },
      walletFundingPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment()),
        update: paymentUpdate,
      },
      $transaction: jest.fn(async (fn) => {
        const tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
          },
          wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'user-w' }) },
          walletFundingPayment: { update: jest.fn() },
        };
        return fn(tx);
      }),
    };

    const service = new PaymentService(
      prisma as never,
      walletService,
      paystack,
      { get: jest.fn() } as never,
      {} as never,
      kycPolicy as never,
      {} as never,
    );

    await expect(service.verifyWalletFunding('u1', 'PSK-WALLET-u1|abc')).rejects.toThrow(/ledger down/i);
    expect(paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: WalletFundingPaymentStatus.REQUIRES_RECONCILIATION },
      }),
    );
  });
});

describe('PaymentService Paystack virtual-account webhook funding', () => {
  const kycPolicy: Pick<KycPolicyService, 'assertFromUserSnapshot'> = {
    assertFromUserSnapshot: jest.fn(),
  };

  it('charge.success to DVA credits wallet via ledger reference', async () => {
    const paystack = {
      verifyTransaction: jest.fn().mockResolvedValue({
        reference: 'ref-va',
        amount: new Decimal('250'),
        amountKobo: 25000,
        currency: 'NGN',
        status: 'success',
        transactionId: 'tx-va',
        customerEmail: null,
        metadata: {},
        channel: 'dedicated_nuban',
        accountNumber: '0123456789',
      }),
    } as unknown as PaystackProvider;

    const virtualAccountService = {
      getActiveAccountByNumber: jest.fn().mockResolvedValue({ id: 'va-1', userId: 'u-va' }),
      upsertDepositEvent: jest.fn(),
    };

    const postDoubleEntry = jest.fn().mockResolvedValue({ created: true, legs: [{}, {}] });
    const walletService = {
      postDoubleEntry,
      getPlatformWallet: jest.fn().mockResolvedValue({ id: 'platform-w' }),
    } as unknown as WalletService;

    const service = new PaymentService(
      {
        $transaction: jest.fn(async (fn) =>
          fn({
            user: {
              findUnique: jest.fn().mockResolvedValue({ isFrozen: false, kycStatus: KycStatus.VERIFIED }),
            },
            wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'w' }) },
          }),
        ),
      } as never,
      walletService,
      paystack,
      { get: jest.fn() } as never,
      { notifyWalletFundedInTransaction: jest.fn() } as never,
      kycPolicy as never,
      virtualAccountService as never,
    );

    await service.handlePaystackWebhook({
      event: 'charge.success',
      data: { reference: 'ref-va', channel: 'dedicated_nuban' },
    });

    expect(paystack.verifyTransaction).toHaveBeenCalledWith('ref-va');
    expect(postDoubleEntry).toHaveBeenCalledWith(
      expect.anything(),
      'PSK_VA_DEPOSIT:tx-va',
      expect.any(Array),
      expect.objectContaining({ operationType: LedgerOperationType.WALLET_FUNDING }),
    );
  });
});
