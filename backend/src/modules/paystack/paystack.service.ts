import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';
import { toDecimal } from '../../common/money/decimal.util';

const BASE_URL = 'https://api.paystack.co';

export interface DedicatedAccountResult {
  accountNumber: string;
  accountName: string;
  bankName: string;
  customerCode: string;
}

export interface PaystackVerifyResult {
  status: 'success';
  amount: number;
  currency: string;
  customer_email: string;
  reference: string;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('config.paystack.secretKey') ??
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ??
      '';
    const baseUrl =
      this.configService.get<string>('config.paystack.baseUrl') ?? BASE_URL;

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Verify Paystack webhook signature (HMAC-SHA512 of **raw** request body).
   * Key: PAYSTACK_SECRET_KEY (see Paystack docs).
   * Do not use JSON.stringify on a parsed object — it will not match.
   */
  verifyWebhookSignature(signature: string, rawBody: Buffer | string): boolean {
    if (!this.secretKey) {
      this.logger.error('PAYSTACK_SECRET_KEY is not configured');
      return false;
    }
    if (!signature) {
      return false;
    }

    const buf = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : '', 'utf8');
    if (!buf.length) {
      return false;
    }

    const computed = crypto.createHmac('sha512', this.secretKey).update(buf).digest('hex');
    const sig = signature.trim();
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(sig, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Helper specifically for investment flows that creates a unique reference
   * and initializes the transaction.
   */
  async createPaymentIntent(
    amount: Decimal,
    email: string,
    currency: string,
    metadata?: Record<string, any>,
  ): Promise<PaystackInitializeResult> {
    const reference = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    
    return this.initializeTransaction(email, amount, reference, {
      currency: currency.toUpperCase(),
      metadata,
    });
  }

  /**
   * Initialize Transaction (Card/Checkout flow)
   */
  async initializeTransaction(
    email: string,
    amount: Decimal,
    reference: string,
    options?: {
      currency?: string;
      callbackUrl?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<PaystackInitializeResult> {
    const amountInSubunit = amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
    
    try {
      const response = await this.client.post<{
        status: boolean;
        data?: { authorization_url: string; access_code: string; reference: string };
      }>('/transaction/initialize', {
        email,
        amount: amountInSubunit,
        reference: reference.trim(),
        currency: (options?.currency ?? 'NGN').toUpperCase(),
        callback_url: options?.callbackUrl,
        metadata: options?.metadata,
      });

      if (!response.data.status || !response.data.data) {
        throw new UnprocessableEntityException('Failed to initialize Paystack transaction');
      }

      return {
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        this.logger.error(`Paystack initialize failed: ${err.message}`, err.response?.data);
        throw new UnprocessableEntityException(err.response?.data?.message || 'Init failed');
      }
      throw err;
    }
  }

  async createCustomer(user: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }): Promise<string> {
    return this.createOrGetCustomer(
      user.email,
      user.firstName ?? 'User',
      user.lastName ?? '',
      user.phone ?? undefined,
    );
  }

  async createOrGetCustomer(
    email: string,
    firstName: string,
    lastName: string,
    phone?: string,
  ): Promise<string> {
    if (!this.secretKey) throw new BadRequestException('Paystack secret key not configured');

    try {
      const response = await this.client.post<{
        status: boolean;
        data?: { customer_code: string };
      }>('/customer', {
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? '',
      });

      return response.data.data?.customer_code || '';
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.data?.customer_code) {
        return err.response.data.data.customer_code;
      }
      throw err;
    }
  }

  async createDedicatedAccount(customerCode: string): Promise<DedicatedAccountResult> {
    const response = await this.client.post('/dedicated_account/assign', {
      customer: customerCode.trim(),
      preferred_bank: 'wema-bank',
    });
    const d = response.data.data;
    return {
      accountNumber: d.account_number,
      accountName: d.account_name,
      bankName: d.bank?.name ?? 'Wema Bank',
      customerCode: d.customer?.customer_code ?? customerCode,
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
    const response = await this.client.get(`/transaction/verify/${encodeURIComponent(reference.trim())}`);
    const data = response.data.data;
    return {
      status: 'success',
      amount: data.amount,
      currency: data.currency ?? 'NGN',
      customer_email: data.customer?.email ?? '',
      reference: data.reference ?? reference,
    };
  }

  static amountFromSubunit(amountSubunit: number): Decimal {
    return toDecimal(amountSubunit).div(100);
  }
}