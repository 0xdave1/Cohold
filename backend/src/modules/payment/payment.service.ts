import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService, PLATFORM_USER_ID } from '../wallet/wallet.service';
import { FlutterwaveService } from './flutterwave.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Currency,
  LedgerOperationType,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { KycPolicyService } from '../kyc/kyc-policy.service';

const FLW_WALLET_TX_PREFIX = 'flw_wallet_';

/** Encode `userId` in `tx_ref` so verify/webhook can credit without relying on provider `meta` echo. */
function buildWalletFundingTxRef(userId: string): string {
  return `${FLW_WALLET_TX_PREFIX}${userId}|${randomUUID()}`;
}

function parseUserIdFromWalletFundingTxRef(txRef: string): string | null {
  if (!txRef.startsWith(FLW_WALLET_TX_PREFIX)) {
    return null;
  }
  const rest = txRef.slice(FLW_WALLET_TX_PREFIX.length);
  const pipe = rest.indexOf('|');
  if (pipe <= 0) {
    return null;
  }
  const userId = rest.slice(0, pipe).trim();
  return userId.length > 0 ? userId : null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly notificationsService: NotificationsService,
    private readonly kycPolicy: KycPolicyService,
  ) {}

  /**
   * Hosted checkout to fund wallet (Flutterwave). `meta` on the charge ties settlement to `userId`.
   */
  async initializeFlutterwavePayment(params: { amount: number; userId: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.kycPolicy.assertFromUserSnapshot({ isFrozen: user.isFrozen, kycStatus: user.kycStatus });

    const reference = buildWalletFundingTxRef(params.userId);
    const { checkoutUrl } = await this.flutterwaveService.initializePayment({
      amount: params.amount,
      email: params.email,
      userId: params.userId,
      reference,
    });

    return { checkoutUrl, reference };
  }

  /**
   * Client callback / manual confirm: verify with Flutterwave, then post ledger credit (idempotent by `reference`).
   */
  async verifyWalletFunding(userId: string, reference: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isFrozen: true, kycStatus: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const embeddedUserId = parseUserIdFromWalletFundingTxRef(reference);
    if (!embeddedUserId || embeddedUserId !== userId) {
      throw new BadRequestException('Invalid funding reference');
    }

    const verified = await this.flutterwaveService.verifyPayment(reference);

    const meta = verified.meta ?? {};
    if (meta.type != null && String(meta.type) !== 'wallet_funding') {
      throw new BadRequestException('Payment does not match this wallet funding session');
    }
    if (meta.userId != null && String(meta.userId) !== userId) {
      throw new BadRequestException('Payment does not match this wallet funding session');
    }

    if (
      verified.customerEmail &&
      user.email.trim().toLowerCase() !== verified.customerEmail.trim().toLowerCase()
    ) {
      throw new BadRequestException('Payment customer does not match the authenticated user');
    }

    let didCredit = false;
    await this.prisma.$transaction(async (tx) => {
      const result = await this.processWalletFunding(tx, {
        userId,
        amount: verified.amount,
        reference,
        providerTransactionId: verified.txId ?? undefined,
      });
      didCredit = result.didCredit;
    });

    if (didCredit) {
      try {
        await this.notificationsService.notifyWalletFunded(
          userId,
          verified.amount.toFixed(2),
          'NGN',
          reference,
        );
      } catch (err) {
        this.logger.warn(`Failed to send wallet funded notification: ${err}`);
      }
    }

    return { ok: true, reference, amount: verified.amount.toFixed(2), credited: didCredit };
  }

  /**
   * Signature-verified Flutterwave webhook (non-transfer events). Credits wallet funding when verification succeeds.
   */
  async handleFlutterwaveWebhook(payload: Record<string, unknown>): Promise<{ received: boolean }> {
    const event = String(payload.event ?? payload.type ?? '').toLowerCase();
    if (!event.includes('charge') && !event.includes('successful')) {
      return { received: true };
    }

    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) {
      return { received: true };
    }

    const status = String(data.status ?? '').toLowerCase();
    if (status !== 'successful') {
      return { received: true };
    }

    const txRef = data.tx_ref as string | undefined;
    if (!txRef) {
      return { received: true };
    }

    const userId = parseUserIdFromWalletFundingTxRef(txRef);
    if (!userId) {
      return { received: true };
    }

    let verified;
    try {
      verified = await this.flutterwaveService.verifyPayment(txRef);
    } catch (err) {
      this.logger.warn(`Flutterwave webhook: verify failed tx_ref=${txRef} err=${String(err)}`);
      return { received: true };
    }

    if (verified.meta?.type != null && String(verified.meta.type) !== 'wallet_funding') {
      this.logger.warn(`Flutterwave webhook: unexpected meta.type tx_ref=${txRef}`);
      return { received: true };
    }
    if (verified.meta?.userId != null && String(verified.meta.userId) !== userId) {
      this.logger.warn(`Flutterwave webhook: meta.userId mismatch tx_ref=${txRef}`);
      return { received: true };
    }

    try {
      let didCredit = false;
      await this.prisma.$transaction(async (tx) => {
        const result = await this.processWalletFunding(tx, {
          userId,
          amount: verified.amount,
          reference: txRef,
          providerTransactionId: verified.txId ?? undefined,
        });
        didCredit = result.didCredit;
      });
      if (didCredit) {
        try {
          await this.notificationsService.notifyWalletFunded(
            userId,
            verified.amount.toFixed(2),
            'NGN',
            txRef,
          );
        } catch (err) {
          this.logger.warn(`Failed to send wallet funded notification: ${err}`);
        }
      }
    } catch (err) {
      this.logger.error(`Flutterwave webhook: ledger post failed tx_ref=${txRef}`, err);
    }

    return { received: true };
  }

  /**
   * Verified Flutterwave wallet funding — posts double-entry inside the caller's transaction.
   * KYC must be verified before crediting user wallets (Issue 5).
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
      provider: 'flutterwave',
      reason: 'flutterwave_wallet_funding',
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
