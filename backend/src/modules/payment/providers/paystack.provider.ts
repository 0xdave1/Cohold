import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import Decimal from 'decimal.js';
import { toDecimal } from '../../../common/money/decimal.util';

const DEFAULT_TIMEOUT_MS = 25_000;

export type PaystackInitializeInput = {
  email: string;
  amount: Decimal;
  currency: 'NGN';
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type PaystackVerifyTransactionResult = {
  reference: string;
  amount: Decimal;
  /** Paystack amount field in kobo (integer). */
  amountKobo: number;
  currency: string;
  status: string;
  paidAt: string | null;
  transactionId: string | null;
  customerEmail: string | null;
  metadata: Record<string, unknown>;
  channel: string | null;
  /** Present for dedicated virtual account / bank transfer credits. */
  accountNumber: string | null;
};

export type PaystackDedicatedAccountResult = {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string | null;
  providerAccountId: string;
  customerCode: string;
  raw: Record<string, unknown>;
};

export type PaystackTransferRecipientResult = {
  recipientCode: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
};

export type PaystackInitiateTransferResult = {
  transferCode: string | null;
  reference: string;
  status: string;
  raw: Record<string, unknown>;
};

@Injectable()
export class PaystackProvider {
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;
  private readonly transfersEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('config.paystack.secretKey') ??
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ??
      '';
    const baseUrl =
      this.configService.get<string>('config.paystack.baseUrl') ??
      (this.configService.get<string>('PAYSTACK_ENV') === 'live'
        ? 'https://api.paystack.co'
        : 'https://api.paystack.co');
    this.transfersEnabled =
      (this.configService.get<string>('config.paystack.transfersEnabled') ??
        this.configService.get<string>('PAYSTACK_TRANSFERS_ENABLED') ??
        'false') === 'true';

    this.client = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: DEFAULT_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  isTransfersEnabled(): boolean {
    return this.transfersEnabled && Boolean(this.secretKey);
  }

  private assertConfigured(): void {
    if (!this.secretKey) {
      throw new ServiceUnavailableException('Paystack is not configured');
    }
  }

  private toSubunit(amount: Decimal, currency: 'NGN'): number {
    if (currency !== 'NGN') {
      throw new BadRequestException('Only NGN is supported for Paystack checkout');
    }
    const kobo = amount.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    if (kobo.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }
    return kobo.toNumber();
  }

  private fromSubunit(amount: number | string, currency: string): Decimal {
    const cur = currency.toUpperCase();
    const raw = toDecimal(amount);
    if (cur === 'NGN') {
      return raw.div(100);
    }
    return raw;
  }

  private sanitizeLogData(data: unknown): unknown {
    if (data == null) return data;
    if (typeof data === 'string') {
      return data.replace(/sk_(live|test)_[A-Za-z0-9]+/gi, '[redacted]');
    }
    if (Array.isArray(data)) {
      return data.map((v) => this.sanitizeLogData(v));
    }
    if (typeof data === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        const key = k.toLowerCase();
        if (key.includes('secret') || key.includes('authorization') || key.includes('signature')) {
          out[k] = '[redacted]';
        } else {
          out[k] = this.sanitizeLogData(v);
        }
      }
      return out;
    }
    return data;
  }

  private mapAxiosError(error: unknown, fallback: string): never {
    if (axios.isAxiosError(error)) {
      const msg =
        (error.response?.data as { message?: string } | undefined)?.message ??
        error.message ??
        fallback;
      this.logger.warn(`${fallback}: ${msg}`, this.sanitizeLogData(error.response?.data));
      throw new UnprocessableEntityException(msg);
    }
    throw error;
  }

  async initializeTransaction(input: PaystackInitializeInput): Promise<PaystackInitializeResult> {
    this.assertConfigured();
    try {
      const response = await this.client.post<{
        status?: boolean;
        message?: string;
        data?: {
          authorization_url?: string;
          access_code?: string;
          reference?: string;
        };
      }>('/transaction/initialize', {
        email: input.email,
        amount: this.toSubunit(input.amount, input.currency),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      });

      const data = response.data?.data;
      if (!response.data?.status || !data?.authorization_url) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Paystack payment initialization failed',
        );
      }
      return {
        authorizationUrl: data.authorization_url,
        accessCode: data.access_code ?? '',
        reference: data.reference ?? input.reference,
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack initialize failed');
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyTransactionResult> {
    this.assertConfigured();
    try {
      const response = await this.client.get<{
        status?: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>(`/transaction/verify/${encodeURIComponent(reference)}`);

      const data = response.data?.data;
      if (!response.data?.status || !data) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Paystack verification payload missing data',
        );
      }

      const status = String(data.status ?? '').toLowerCase();
      if (status !== 'success') {
        throw new UnprocessableEntityException(`Payment not successful: ${status || 'unknown'}`);
      }

      const currency = String(data.currency ?? 'NGN').toUpperCase();
      const amountKoboRaw = data.amount as number | string | undefined;
      const amountKobo = Number(amountKoboRaw ?? 0);
      if (!Number.isFinite(amountKobo) || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        throw new UnprocessableEntityException('Paystack verification returned invalid amount');
      }
      const amount = this.fromSubunit(amountKobo, currency);
      const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
      const auth = (data.authorization as Record<string, unknown> | undefined) ?? {};

      return {
        reference: String(data.reference ?? reference),
        amount,
        amountKobo,
        currency,
        status,
        paidAt: data.paid_at != null ? String(data.paid_at) : null,
        transactionId: data.id != null ? String(data.id) : null,
        customerEmail: ((data.customer as Record<string, unknown> | undefined)?.email as string | undefined) ?? null,
        metadata,
        channel: data.channel != null ? String(data.channel) : null,
        accountNumber:
          (auth.receiver_bank_account_number as string | undefined) ??
          (metadata.account_number as string | undefined) ??
          (metadata.receiver_account_number as string | undefined) ??
          null,
      };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      this.mapAxiosError(error, 'Paystack verify failed');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    if (!this.secretKey || !signatureHeader) return false;
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const digest = createHmac('sha512', this.secretKey).update(payload).digest('hex');
    try {
      const a = Buffer.from(digest, 'utf8');
      const b = Buffer.from(signatureHeader.trim(), 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async createCustomer(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<string> {
    this.assertConfigured();
    try {
      const response = await this.client.post<{
        status?: boolean;
        data?: { customer_code?: string };
        message?: string;
      }>('/customer', {
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        phone: params.phone,
      });
      const code = response.data?.data?.customer_code;
      if (!response.data?.status || !code) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Paystack customer creation failed',
        );
      }
      return code;
    } catch (error) {
      this.mapAxiosError(error, 'Paystack create customer failed');
    }
  }

  async createDedicatedVirtualAccount(params: {
    customerCode: string;
    preferredBank?: string;
  }): Promise<PaystackDedicatedAccountResult> {
    this.assertConfigured();
    try {
      const body: Record<string, unknown> = { customer: params.customerCode };
      const preferred =
        params.preferredBank ??
        this.configService.get<string>('config.paystack.dvaPreferredBank') ??
        this.configService.get<string>('PAYSTACK_DVA_PREFERRED_BANK');
      if (preferred) body.preferred_bank = preferred;

      const response = await this.client.post<{
        status?: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>('/dedicated_account', body);

      const data = response.data?.data ?? {};
      const accountNumber = String(
        (data.account_number as string | undefined) ??
          ((data.account as Record<string, unknown> | undefined)?.account_number as string | undefined) ??
          '',
      ).trim();
      const accountName = String(
        (data.account_name as string | undefined) ??
          ((data.account as Record<string, unknown> | undefined)?.account_name as string | undefined) ??
          '',
      ).trim();
      const bankName = String(
        (data.bank as Record<string, unknown> | undefined)?.name ??
          data.bank_name ??
          '',
      ).trim();
      const bankCode =
        ((data.bank as Record<string, unknown> | undefined)?.slug as string | undefined) ??
        (data.bank_code as string | undefined) ??
        null;

      if (!response.data?.status || !accountNumber || !accountName) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Paystack dedicated account provisioning incomplete',
        );
      }

      return {
        accountNumber,
        accountName,
        bankName: bankName || 'Partner bank',
        bankCode,
        providerAccountId: data.id != null ? String(data.id) : params.customerCode,
        customerCode: params.customerCode,
        raw: data,
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack dedicated account failed');
    }
  }

  async fetchDedicatedVirtualAccount(id: string): Promise<Record<string, unknown>> {
    this.assertConfigured();
    try {
      const response = await this.client.get<{ data?: Record<string, unknown> }>(
        `/dedicated_account/${encodeURIComponent(id)}`,
      );
      return response.data?.data ?? {};
    } catch (error) {
      this.mapAxiosError(error, 'Paystack fetch dedicated account failed');
    }
  }

  async resolveBankAccount(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountNumber: string; accountName: string }> {
    this.assertConfigured();
    try {
      const response = await this.client.get<{
        status?: boolean;
        data?: { account_number?: string; account_name?: string };
        message?: string;
      }>('/bank/resolve', {
        params: {
          account_number: params.accountNumber,
          bank_code: params.bankCode,
        },
      });
      const data = response.data?.data;
      if (!response.data?.status || !data?.account_name) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Unable to verify bank account details',
        );
      }
      return {
        accountNumber: String(data.account_number ?? params.accountNumber),
        accountName: String(data.account_name).trim(),
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack bank resolve failed');
    }
  }

  async listBanks(): Promise<Array<{ code: string; name: string }>> {
    this.assertConfigured();
    try {
      const response = await this.client.get<{
        status?: boolean;
        data?: Array<{ code?: string; name?: string }>;
      }>('/bank', { params: { country: 'nigeria', perPage: 100 } });
      return (response.data?.data ?? [])
        .filter((b) => b.code && b.name)
        .map((b) => ({ code: String(b.code), name: String(b.name) }));
    } catch (error) {
      this.mapAxiosError(error, 'Paystack list banks failed');
    }
  }

  async createTransferRecipient(params: {
    accountNumber: string;
    bankCode: string;
    name: string;
    currency: 'NGN';
  }): Promise<PaystackTransferRecipientResult> {
    this.assertConfigured();
    if (!this.isTransfersEnabled()) {
      throw new ServiceUnavailableException('Paystack transfers are not enabled');
    }
    try {
      const response = await this.client.post<{
        status?: boolean;
        data?: { recipient_code?: string; details?: Record<string, unknown> };
        message?: string;
      }>('/transferrecipient', {
        type: 'nuban',
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: params.currency,
      });
      const code = response.data?.data?.recipient_code;
      if (!response.data?.status || !code) {
        throw new UnprocessableEntityException(
          response.data?.message ?? 'Paystack transfer recipient creation failed',
        );
      }
      return {
        recipientCode: code,
        accountNumber: params.accountNumber,
        accountName: params.name,
        bankCode: params.bankCode,
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack transfer recipient failed');
    }
  }

  async initiateTransfer(params: {
    recipientCode: string;
    amount: Decimal;
    reference: string;
    reason: string;
    currency: 'NGN';
  }): Promise<PaystackInitiateTransferResult> {
    this.assertConfigured();
    if (!this.isTransfersEnabled()) {
      throw new ServiceUnavailableException('Paystack transfers are not enabled');
    }
    try {
      const response = await this.client.post<{
        status?: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>('/transfer', {
        source: 'balance',
        amount: this.toSubunit(params.amount, params.currency),
        reference: params.reference,
        recipient: params.recipientCode,
        reason: params.reason,
        currency: params.currency,
      });
      const data = response.data?.data ?? {};
      return {
        transferCode: data.transfer_code != null ? String(data.transfer_code) : data.id != null ? String(data.id) : null,
        reference: String(data.reference ?? params.reference),
        status: String(data.status ?? 'pending').toLowerCase(),
        raw: data,
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack transfer initiation failed');
    }
  }

  async getTransfer(transferIdOrCode: string): Promise<{
    status: string;
    reference: string | null;
    transferCode: string | null;
    failureReason: string | null;
    raw: Record<string, unknown>;
  }> {
    this.assertConfigured();
    try {
      const response = await this.client.get<{
        status?: boolean;
        data?: Record<string, unknown>;
      }>(`/transfer/${encodeURIComponent(transferIdOrCode)}`);
      const data = response.data?.data ?? {};
      return {
        status: String(data.status ?? 'unknown').toLowerCase(),
        reference: data.reference != null ? String(data.reference) : null,
        transferCode:
          data.transfer_code != null
            ? String(data.transfer_code)
            : data.id != null
              ? String(data.id)
              : transferIdOrCode,
        failureReason:
          (data.reason as string | undefined) ??
          (data.complete_message as string | undefined) ??
          null,
        raw: data,
      };
    } catch (error) {
      this.mapAxiosError(error, 'Paystack transfer status failed');
    }
  }
}
