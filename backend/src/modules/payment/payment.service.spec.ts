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
