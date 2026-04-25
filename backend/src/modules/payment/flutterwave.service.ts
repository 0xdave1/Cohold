import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { toDecimal } from '../../common/money/decimal.util';
import Decimal from 'decimal.js';

type InitializePaymentInput = {
  amount: number;
  email: string;
  reference: string;
};

type VerifyPaymentResult = {
  reference: string;
  amount: Decimal;
  status: string;
  txId: string | null;
};

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly client: AxiosInstance;
  private readonly appBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.get<string>('config.flutterwave.secretKey') ??
      this.configService.get<string>('FLW_SECRET_KEY') ??
      '';
    const baseUrl =
      this.configService.get<string>('config.flutterwave.baseUrl') ??
      this.configService.get<string>('FLW_BASE_URL') ??
      'https://api.flutterwave.com/v3';
    this.appBaseUrl =
      this.configService.get<string>('config.appBaseUrl') ??
      this.configService.get<string>('APP_BASE_URL') ??
      'http://localhost:3000';

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initializePayment(dto: InitializePaymentInput): Promise<{ checkoutUrl: string }> {
    const amount = toDecimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    try {
      const response = await this.client.post<{
        status: string;
        data?: { link?: string };
      }>('/payments', {
        tx_ref: dto.reference,
        amount: amount.toFixed(2),
        currency: 'NGN',
        redirect_url: `${this.appBaseUrl.replace(/\/$/, '')}/wallet?status=success`,
        customer: {
          email: dto.email,
        },
        meta: { type: 'wallet_funding' },
      });

      const checkoutUrl = response.data?.data?.link;
      if (!checkoutUrl) {
        throw new UnprocessableEntityException('Flutterwave payment initialization failed');
      }
      return { checkoutUrl };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Flutterwave initialize failed: ${error.message}`, error.response?.data);
        throw new UnprocessableEntityException(
          error.response?.data?.message ?? 'Flutterwave payment initialization failed',
        );
      }
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    try {
      const response = await this.client.get<{
        status: string;
        data?: {
          status?: string;
          amount?: number | string;
          tx_ref?: string;
          id?: number;
        };
      }>('/transactions/verify_by_reference', {
        params: { tx_ref: reference },
      });

      const tx = response.data?.data;
      if (!tx) {
        throw new UnprocessableEntityException('Flutterwave verification payload missing data');
      }

      if (tx.status !== 'successful') {
        throw new UnprocessableEntityException(`Payment not successful: ${tx.status ?? 'unknown'}`);
      }

      return {
        reference: tx.tx_ref ?? reference,
        amount: toDecimal(tx.amount ?? 0),
        status: tx.status,
        txId: tx.id != null ? String(tx.id) : null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Flutterwave verify failed: ${error.message}`, error.response?.data);
        throw new UnprocessableEntityException(
          error.response?.data?.message ?? 'Flutterwave payment verification failed',
        );
      }
      throw error;
    }
  }
}
