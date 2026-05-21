import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService, PLATFORM_USER_ID } from '../wallet/wallet.service';
import { PaystackProvider } from './providers/paystack.provider';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Currency,
  LedgerOperationType,
  TransactionDirection,
  TransactionType,
  VirtualAccountDepositStatus,
  WalletFundingPaymentStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { KycPolicyService } from '../kyc/kyc-policy.service';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';
import { toDecimal } from '../../common/money/decimal.util';
import { nairaStringToKobo, parseNairaAmountString } from '../../common/money/naira-amount.util';
import type { PaystackVerifyTransactionResult } from './providers/paystack.provider';

const PSK_WALLET_TX_PREFIX = 'PSK-WALLET-';

function buildWalletFundingReference(userId: string): string {
  return `${PSK_WALLET_TX_PREFIX}${userId}|${randomUUID()}`;
}

function parseUserIdFromWalletFundingReference(reference: string): string | null {
  if (!reference.startsWith(PSK_WALLET_TX_PREFIX)) {
    return null;
  }
  const rest = reference.slice(PSK_WALLET_TX_PREFIX.length);
  const pipe = rest.indexOf('|');
  if (pipe <= 0) return null;
  const userId = rest.slice(0, pipe).trim();
  return userId.length > 0 ? userId : null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly paystack: PaystackProvider,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly kycPolicy: KycPolicyService,
    private readonly virtualAccountService: VirtualAccountService,
  ) {}

  private callbackUrl(): string {
    return (
      this.configService.get<string>('config.paystack.callbackUrl') ??
      this.configService.get<string>('PAYSTACK_CALLBACK_URL') ??
      `${(this.configService.get<string>('config.appBaseUrl') ?? 'http://localhost:3000').replace(/\/$/, '')}/dashboard/wallet?payment=callback`
    );
  }

  /**
   * Hosted Paystack checkout to fund wallet. No wallet credit on initialize.
   */
  async initializeWalletFunding(params: { amountNaira: string; userId: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.kycPolicy.assertFromUserSnapshot({ isFrozen: user.isFrozen, kycStatus: user.kycStatus });

    const amount = parseNairaAmountString(params.amountNaira);
    const amountKobo = nairaStringToKobo(params.amountNaira);
    const reference = buildWalletFundingReference(params.userId);

    await this.prisma.walletFundingPayment.create({
      data: {
        userId: params.userId,
        internalReference: reference,
        amountNaira: amount.toFixed(4),
        amountKobo,
        currency: Currency.NGN,
        status: WalletFundingPaymentStatus.PENDING,
      },
    });

    const init = await this.paystack.initializeTransaction({
      email: params.email,
      amount,
      currency: 'NGN',
      reference,
      callbackUrl: this.callbackUrl(),
      metadata: {
        type: 'wallet_funding',
        purpose: 'wallet_funding',
        userId: params.userId,
        expectedAmount: amount.toFixed(2),
        expectedAmountKobo: amountKobo,
      },
    });

    return {
      checkoutUrl: init.authorizationUrl,
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
    };
  }

  /**
   * Client callback: verify with Paystack, then post ledger credit (idempotent by reference).
   */
  async verifyWalletFunding(userId: string, reference: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isFrozen: true, kycStatus: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const embeddedUserId = parseUserIdFromWalletFundingReference(reference);
    if (!embeddedUserId || embeddedUserId !== userId) {
      throw new BadRequestException('Invalid funding reference');
    }

    const verified = await this.paystack.verifyTransaction(reference);
    const { didCredit, paymentStatus } = await this.settleVerifiedWalletFundingCheckout({
      userId,
      userEmail: user.email,
      reference,
      verified,
    });

    return {
      ok: true,
      reference,
      amountNaira: verified.amount.toFixed(2),
      credited: didCredit,
      status: paymentStatus,
    };
  }

  private assertVerifiedWalletFundingSession(
    user: { email: string },
    verified: PaystackVerifyTransactionResult,
    userId: string,
    pending: { amountKobo: number; amountNaira: Prisma.Decimal; userId: string },
  ): void {
    const meta = verified.metadata ?? {};
    if (meta.type != null && String(meta.type) !== 'wallet_funding') {
      throw new BadRequestException('Payment does not match this wallet funding session');
    }
    if (meta.userId != null && String(meta.userId) !== userId) {
      throw new BadRequestException('Payment does not match this wallet funding session');
    }
    if (verified.currency.toUpperCase() !== 'NGN') {
      throw new BadRequestException('Only NGN wallet funding is supported');
    }
    if (pending.userId !== userId) {
      throw new BadRequestException('Payment does not match this wallet funding session');
    }
    if (verified.amountKobo !== pending.amountKobo) {
      throw new BadRequestException('Payment amount does not match the initialized funding session');
    }
    const expectedNaira = toDecimal(pending.amountNaira.toString());
    if (!verified.amount.equals(expectedNaira)) {
      throw new BadRequestException('Payment amount does not match the initialized funding session');
    }
    const expectedKoboMeta = meta.expectedAmountKobo;
    if (expectedKoboMeta != null && Number(expectedKoboMeta) !== verified.amountKobo) {
      throw new BadRequestException('Payment amount does not match the initialized funding session');
    }
    if (
      verified.customerEmail &&
      user.email.trim().toLowerCase() !== verified.customerEmail.trim().toLowerCase()
    ) {
      throw new BadRequestException('Payment customer does not match the authenticated user');
    }
  }

  private async settleVerifiedWalletFundingCheckout(params: {
    userId: string;
    userEmail: string;
    reference: string;
    verified: PaystackVerifyTransactionResult;
  }): Promise<{ didCredit: boolean; paymentStatus: WalletFundingPaymentStatus }> {
    const pending = await this.prisma.walletFundingPayment.findUnique({
      where: { internalReference: params.reference },
    });
    if (!pending) {
      throw new BadRequestException('No pending wallet funding session for this reference');
    }
    if (pending.status === WalletFundingPaymentStatus.COMPLETED) {
      return { didCredit: false, paymentStatus: WalletFundingPaymentStatus.COMPLETED };
    }

    this.assertVerifiedWalletFundingSession(
      { email: params.userEmail },
      params.verified,
      params.userId,
      pending,
    );

    try {
      let didCredit = false;
      await this.prisma.$transaction(async (tx) => {
        const result = await this.processWalletFunding(tx, {
          userId: params.userId,
          amount: params.verified.amount,
          reference: params.reference,
          providerTransactionId: params.verified.transactionId ?? undefined,
        });
        didCredit = result.didCredit;
        if (didCredit) {
          await this.notificationsService.notifyWalletFundedInTransaction(
            tx,
            params.userId,
            params.verified.amount.toFixed(2),
            'NGN',
            params.reference,
          );
        }
        await tx.walletFundingPayment.update({
          where: { id: pending.id },
          data: {
            status: WalletFundingPaymentStatus.COMPLETED,
            providerTransactionId: params.verified.transactionId ?? undefined,
            completedAt: new Date(),
          },
        });
      });
      return { didCredit, paymentStatus: WalletFundingPaymentStatus.COMPLETED };
    } catch (err) {
      this.logger.error(
        `Wallet funding settlement failed reference=${params.reference}; marking REQUIRES_RECONCILIATION`,
        err,
      );
      await this.prisma.walletFundingPayment.update({
        where: { id: pending.id },
        data: { status: WalletFundingPaymentStatus.REQUIRES_RECONCILIATION },
      });
      throw err;
    }
  }

  /**
   * Signature-verified Paystack webhook. Credits wallet funding / DVA deposits after verification.
   */
  async handlePaystackWebhook(payload: Record<string, unknown>): Promise<{ received: boolean }> {
    const event = String(payload.event ?? '').toLowerCase();

    if (event.startsWith('transfer.')) {
      return { received: true };
    }

    if (event === 'charge.success' || event.includes('charge.success')) {
      const data = (payload.data as Record<string, unknown>) ?? {};
      const reference = data.reference != null ? String(data.reference) : null;
      const channel = data.channel != null ? String(data.channel) : '';
      const authorization = (data.authorization as Record<string, unknown> | undefined) ?? {};
      const accountNumber =
        (authorization.receiver_bank_account_number as string | undefined) ??
        (data.account_number as string | undefined) ??
        null;

      if (accountNumber || channel === 'dedicated_nuban' || channel === 'bank_transfer') {
        if (reference) {
          await this.handleVirtualAccountDepositFromCharge(reference, accountNumber, payload);
        }
        return { received: true };
      }

      if (!reference) {
        return { received: true };
      }

      const userId = parseUserIdFromWalletFundingReference(reference);
      if (!userId) {
        return { received: true };
      }

      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (!user?.email) {
          this.logger.warn(`Paystack webhook: user missing for reference=${reference}`);
          return { received: true };
        }
        const verified = await this.paystack.verifyTransaction(reference);
        await this.settleVerifiedWalletFundingCheckout({
          userId,
          userEmail: user.email,
          reference,
          verified,
        });
      } catch (err) {
        this.logger.error(`Paystack webhook: wallet funding settlement failed reference=${reference}`, err);
      }
      return { received: true };
    }

    this.logger.debug(`Paystack webhook ignored event=${event}`);
    return { received: true };
  }

  private async handleVirtualAccountDepositFromCharge(
    reference: string,
    accountNumberHint: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    let verified;
    try {
      verified = await this.paystack.verifyTransaction(reference);
    } catch (error) {
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: null,
        providerReference: reference,
        accountNumber: accountNumberHint,
        status: VirtualAccountDepositStatus.FAILED,
        reason: `Verification failed: ${String(error)}`,
        payload,
      });
      return;
    }

    if (verified.currency.toUpperCase() !== Currency.NGN) {
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: verified.transactionId,
        providerReference: verified.reference,
        accountNumber: verified.accountNumber ?? accountNumberHint,
        amount: verified.amount.toFixed(2),
        currency: Currency.NGN,
        status: VirtualAccountDepositStatus.FAILED,
        reason: `Unsupported currency: ${verified.currency}`,
        payload,
      });
      return;
    }

    const resolvedAccountNumber = verified.accountNumber ?? accountNumberHint;
    if (!resolvedAccountNumber) {
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: verified.transactionId,
        providerReference: verified.reference,
        status: VirtualAccountDepositStatus.FAILED,
        reason: 'Missing virtual account number on Paystack charge',
        payload,
      });
      return;
    }

    const virtualAccount = await this.virtualAccountService.getActiveAccountByNumber(resolvedAccountNumber);
    if (!virtualAccount) {
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: verified.transactionId,
        providerReference: verified.reference,
        accountNumber: resolvedAccountNumber,
        amount: verified.amount.toFixed(2),
        currency: Currency.NGN,
        status: VirtualAccountDepositStatus.UNMATCHED,
        reason: 'No active virtual account matched this deposit.',
        payload,
      });
      return;
    }

    const ledgerReference = `PSK_VA_DEPOSIT:${verified.transactionId ?? reference}`;
    try {
      let didCredit = false;
      await this.prisma.$transaction(async (tx) => {
        const result = await this.processWalletFunding(tx, {
          userId: virtualAccount.userId,
          amount: verified.amount,
          reference: ledgerReference,
          providerTransactionId: verified.transactionId ?? undefined,
        });
        didCredit = result.didCredit;
        if (didCredit) {
          await this.notificationsService.notifyWalletFundedInTransaction(
            tx,
            virtualAccount.userId,
            verified.amount.toFixed(2),
            'NGN',
            ledgerReference,
          );
        }
      });
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: verified.transactionId,
        providerReference: verified.reference,
        accountNumber: resolvedAccountNumber,
        amount: verified.amount.toFixed(2),
        currency: Currency.NGN,
        status: didCredit ? VirtualAccountDepositStatus.CREDITED : VirtualAccountDepositStatus.VERIFIED,
        reason: didCredit ? null : 'Duplicate deposit event; ledger already posted.',
        payload,
        userId: virtualAccount.userId,
        virtualAccountId: virtualAccount.id,
      });
    } catch (error) {
      await this.virtualAccountService.upsertDepositEvent({
        providerTransactionId: verified.transactionId,
        providerReference: verified.reference,
        accountNumber: resolvedAccountNumber,
        amount: verified.amount.toFixed(2),
        currency: Currency.NGN,
        status: VirtualAccountDepositStatus.FAILED,
        reason: `Ledger posting failed: ${String(error)}`,
        payload,
        userId: virtualAccount.userId,
        virtualAccountId: virtualAccount.id,
      });
    }
  }

  /**
   * Verified Paystack wallet funding — posts double-entry inside the caller's transaction.
   */
  async processWalletFunding(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      amount: Decimal;
      reference: string;
      providerTransactionId?: string;
    },
  ): Promise<{ didCredit: boolean }> {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { isFrozen: true, kycStatus: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.kycPolicy.assertFromUserSnapshot(user);

    const platformWallet = await this.walletService.getPlatformWallet(tx, Currency.NGN);
    const userWallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: params.userId, currency: Currency.NGN } },
    });
    if (!userWallet) {
      throw new BadRequestException('User wallet not found');
    }

    const meta = {
      provider: 'paystack',
      reason: 'paystack_wallet_funding',
      providerTransactionId: params.providerTransactionId ?? null,
    } as Prisma.InputJsonValue;

    const { created } = await this.walletService.postDoubleEntry(
      tx,
      params.reference,
      [
        {
          walletId: platformWallet.id,
          userId: PLATFORM_USER_ID,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.DEBIT,
          amount: params.amount,
          currency: Currency.NGN,
          metadata: meta,
        },
        {
          walletId: userWallet.id,
          userId: params.userId,
          type: TransactionType.WALLET_TOP_UP,
          direction: TransactionDirection.CREDIT,
          amount: params.amount,
          currency: Currency.NGN,
          metadata: meta,
        },
      ],
      {
        operationType: LedgerOperationType.WALLET_FUNDING,
        sourceModule: 'payment.processWalletFunding',
        sourceId: params.reference,
      },
    );

    return { didCredit: created };
  }
}
