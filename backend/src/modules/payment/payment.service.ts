import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { InvestmentService } from '../investment/investment.service';
import { PaystackService } from '../paystack/paystack.service';
import { Currency, Transaction } from '@prisma/client';
import { toDecimal } from '../../common/money/decimal.util';
import Decimal from 'decimal.js';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

const INVESTMENT_FEE_RATE = 0.02;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly investmentService: InvestmentService,
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Card checkout: initialize Paystack payment to fund wallet (metadata ties webhook to user).
   */
  async initializeWalletFunding(userId: string, dto: InitializePaymentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (dto.currency !== Currency.NGN) {
      throw new BadRequestException('Card funding is only supported for NGN');
    }
    const amount = toDecimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    const reference = `wallet_${randomUUID()}`;
    const frontendUrl =
      this.configService.get<string>('config.frontendUrl') ?? 'http://localhost:3001';
    const callbackUrl = `${frontendUrl.replace(/\/$/, '')}/dashboard/wallet?status=success`;

    const init = await this.paystackService.initializeTransaction(user.email, amount, reference, {
      currency: 'NGN',
      callbackUrl,
      metadata: {
        userId,
        type: 'wallet_funding',
      },
    });

    return {
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
    };
  }

  /**
   * Handle Paystack webhook events.
   * Records all events for audit. Processes charge.success (top-up or investment).
   */
  async handlePaystackEvent(payload: Record<string, unknown>): Promise<void> {
    const event = payload.event as string | undefined;
    if (!event) return;

    this.logger.log(`Paystack webhook event=${event} raw=${JSON.stringify(payload)}`);

    const reference = (payload.data as Record<string, unknown>)?.reference as string | undefined;

    const webhookRecord = await this.prisma.paystackWebhookEvent.create({
      data: {
        event,
        reference: reference ?? null,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    try {
      switch (event) {
        case 'charge.success':
          await this.handleChargeSuccess(payload);
          break;
        case 'charge.failed':
        case 'charge.disputed':
          await this.handleChargeFailedOrDisputed(payload, event);
          break;
        default:
          this.logger.debug(`Unhandled Paystack event: ${event}`);
      }

      await this.prisma.paystackWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.prisma.paystackWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: { error: errMsg },
      });
      throw err;
    }
  }

  private async handleChargeFailedOrDisputed(
    payload: Record<string, unknown>,
    event: string,
  ): Promise<void> {
    const data = payload.data as Record<string, unknown> | undefined;
    const reference = data?.reference as string | undefined;
    this.logger.warn(`Paystack ${event} for reference: ${reference}`);
    // No wallet credit, no investment. Event already recorded for audit.
  }

  private async handleChargeSuccess(payload: Record<string, unknown>): Promise<void> {
    const data = payload.data as Record<string, unknown> | undefined;
    const reference = data?.reference as string | undefined;
    const amountKobo = data?.amount as number | undefined;
    const currencyCode = (data?.currency as string) ?? 'NGN';
    const customerEmail = (data?.customer as Record<string, unknown>)?.email as string | undefined;
    const metadata = data?.metadata as Record<string, string> | undefined;

    if (!reference || amountKobo == null) {
      this.logger.warn('charge.success missing critical fields');
      return;
    }

    this.logger.log(
      `charge.success reference=${reference} amountKobo=${amountKobo} email=${customerEmail} metadata=${JSON.stringify(metadata)}`,
    );

    // Paystack sends amount in kobo (smallest unit). Convert to NGN before crediting.
    // Example: 500000 kobo = ₦5000
    const amountInNaira = toDecimal(amountKobo).div(100).toDecimalPlaces(4, Decimal.ROUND_DOWN);

    // Card wallet funding (explicit user id in metadata)
    if (metadata?.type === 'wallet_funding' && metadata?.userId) {
      await this.processWalletFundingFromWebhook({
        reference,
        amountInNaira,
        currencyCode,
        userId: metadata.userId,
      });
      return;
    }

    if (metadata?.type === 'investment' && metadata?.propertyId && metadata?.shares && metadata?.userId) {
      await this.processInvestmentFromWebhook({
        reference,
        amountKobo,
        amountInNaira,
        currencyCode,
        propertyId: metadata.propertyId,
        shares: metadata.shares,
        userId: metadata.userId,
      });
      return;
    }

    await this.processTopUpFromWebhook({
      reference,
      amountInNaira,
      currencyCode,
      customerEmail,
      data: data ?? {},
    });
  }

  private async processInvestmentFromWebhook(params: {
    reference: string;
    amountKobo: number;
    amountInNaira: Decimal;
    currencyCode: string;
    propertyId: string;
    shares: string;
    userId: string;
  }): Promise<void> {
    const { reference, amountKobo, currencyCode, propertyId, shares, userId } = params;

    const existingInvestment = await this.prisma.investment.findFirst({
      where: { clientReference: reference },
    });
    if (existingInvestment) {
      return;
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new UnprocessableEntityException('Property not found for investment webhook');
    }
    if (property.currency !== currencyCode) {
      throw new UnprocessableEntityException('Currency mismatch');
    }

    const sharePrice = toDecimal(property.totalValue.toString()).div(
      toDecimal(property.sharesTotal.toString()),
    );
    const sharesDec = toDecimal(shares);
    const investmentAmount = sharePrice.mul(sharesDec).toDecimalPlaces(8, Decimal.ROUND_DOWN);
    const investmentFee = investmentAmount.mul(INVESTMENT_FEE_RATE).toDecimalPlaces(4, Decimal.ROUND_DOWN);
    const totalCharge = investmentAmount.plus(investmentFee).toDecimalPlaces(4, Decimal.ROUND_DOWN);

    const expectedKobo = totalCharge.mul(100).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
    if (Math.abs(amountKobo - expectedKobo) > 1) {
      throw new UnprocessableEntityException(
        `Amount mismatch: expected ${expectedKobo} kobo, got ${amountKobo}`,
      );
    }

    // Idempotency: ignore if already processed (prevents Paystack retries from double-crediting)
    const existingTx = await this.prisma.transaction.findUnique({
      where: { reference: `PAYSTACK-TOPUP-${reference}` },
    });
    if (existingTx) {
      return;
    }

    await this.walletService.credit(userId, {
      currency: Currency.NGN,
      amount: totalCharge.toFixed(4),
      reference: `PAYSTACK-TOPUP-${reference}`,
      reason: 'paystack_investment_charge_success',
    });

    await this.investmentService.createFractional(userId, {
      propertyId,
      shares,
      clientReference: reference,
    });
  }

  private async processTopUpFromWebhook(params: {
    reference: string;
    amountInNaira: Decimal;
    currencyCode: string;
    customerEmail: string | undefined;
    data: Record<string, unknown>;
  }): Promise<void> {
    const { reference, amountInNaira, customerEmail, data } = params;

    const accountNumber =
      (data?.authorization as Record<string, unknown>)?.account_number ??
      (data?.dedicated_account as Record<string, unknown>)?.account_number;
    let user = null;

    if (accountNumber) {
      const virtualAccount = await this.prisma.virtualAccount.findUnique({
        where: { accountNumber: String(accountNumber) },
        include: { user: true },
      });
      if (virtualAccount) user = virtualAccount.user;
    }

    if (!user && customerEmail) {
      user = await this.prisma.user.findUnique({
        where: { email: customerEmail },
      });
    }

    if (!user) {
      this.logger.error(
        `User not found for charge.success (email: ${customerEmail}, account: ${accountNumber})`,
      );
      throw new BadRequestException('User not found for payment');
    }

    // Idempotency: ignore if transaction with same reference already exists (prevents Paystack retries from double-crediting)
    const existingTx: Transaction | null = await this.prisma.transaction.findUnique({
      where: { reference },
    });
    if (existingTx) {
      return;
    }

    await this.walletService.credit(user.id, {
      currency: Currency.NGN,
      amount: amountInNaira.toFixed(4),
      reference,
      reason: 'paystack_charge_success',
    });
  }

  private async processWalletFundingFromWebhook(params: {
    reference: string;
    amountInNaira: Decimal;
    currencyCode: string;
    userId: string;
  }): Promise<void> {
    const { reference, amountInNaira, currencyCode, userId } = params;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`wallet_funding: user not found ${userId}`);
      throw new BadRequestException('User not found for wallet funding');
    }

    const currency = currencyCode as Currency;
    if (currency !== Currency.NGN) {
      throw new BadRequestException('Unsupported currency for wallet funding');
    }

    const existingTx: Transaction | null = await this.prisma.transaction.findUnique({
      where: { reference },
    });
    if (existingTx) {
      this.logger.log(`wallet_funding: idempotent skip reference=${reference}`);
      return;
    }

    await this.walletService.credit(user.id, {
      currency,
      amount: amountInNaira.toFixed(4),
      reference,
      reason: 'paystack_card_wallet_funding',
    });
  }
}
