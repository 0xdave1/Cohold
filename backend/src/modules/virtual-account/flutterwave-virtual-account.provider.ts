import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Currency, VirtualAccountStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import {
  CreateVirtualAccountInput,
  VirtualAccountProviderClient,
  VirtualAccountProvisioningResult,
  VirtualAccountStatusResult,
} from './virtual-account-provider.interface';

@Injectable()
export class FlutterwaveVirtualAccountProvider implements VirtualAccountProviderClient {
  private readonly logger = new Logger(FlutterwaveVirtualAccountProvider.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.get<string>('config.flutterwave.secretKey') ??
      this.configService.get<string>('FLW_SECRET_KEY') ??
      '';
    const baseUrl =
      this.configService.get<string>('config.flutterwave.baseUrl') ??
      this.configService.get<string>('FLW_BASE_URL') ??
      'https://api.flutterwave.com/v3';
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private toFailure(message: string, raw?: Record<string, unknown>): VirtualAccountProvisioningResult {
    const lower = message.toLowerCase();
    const transient = /(timeout|temporar|network|429|rate|try again|service unavailable)/.test(lower);
    return {
      status: transient ? VirtualAccountStatus.REQUIRES_RETRY : VirtualAccountStatus.FAILED,
      failureReason: message.slice(0, 220),
      rawProviderResponse: raw,
    };
  }

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountProvisioningResult> {
    if (input.currency !== Currency.NGN) {
      return {
        status: VirtualAccountStatus.FAILED,
        failureReason: 'Only NGN virtual accounts are currently supported.',
      };
    }
    try {
      const response = await this.client.post<{
        status?: string;
        message?: string;
        data?: Record<string, unknown>;
      }>('/virtual-account-numbers', {
        email: input.email,
        is_permanent: true,
        bvn: undefined,
        tx_ref: input.previousProviderReference ?? `cohold-va-${input.userId}`,
        narration: 'Cohold wallet funding',
      });

      const data = response.data?.data ?? {};
      const accountNumber = String(
        (data.account_number as string | undefined) ??
          (data.accountNumber as string | undefined) ??
          '',
      ).trim();
      const bankName = String(
        (data.bank_name as string | undefined) ?? (data.bankName as string | undefined) ?? '',
      ).trim();
      const accountName = String(
        (data.account_name as string | undefined) ?? (data.accountName as string | undefined) ?? '',
      ).trim();
      const providerAccountId = data.id != null ? String(data.id) : undefined;
      const providerReference =
        (data.order_ref as string | undefined) ??
        (data.flw_ref as string | undefined) ??
        (data.reference as string | undefined);

      if (!accountNumber || !bankName || !accountName) {
        return this.toFailure(
          response.data?.message ?? 'Virtual account provider did not return account details.',
          data,
        );
      }
      return {
        status: VirtualAccountStatus.ACTIVE,
        accountNumber,
        bankName,
        accountName,
        bankCode:
          (data.bank_code as string | undefined) ??
          (data.bankCode as string | undefined) ??
          undefined,
        providerAccountId,
        providerReference,
        rawProviderResponse: data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = String(error.response?.data?.message ?? error.message ?? 'Provider request failed');
        this.logger.warn(`Flutterwave virtual account provisioning failed: ${msg}`);
        return this.toFailure(msg, (error.response?.data as Record<string, unknown>) ?? undefined);
      }
      return this.toFailure(String(error));
    }
  }

  async getVirtualAccountStatus(input: {
    providerReference?: string;
    providerAccountId?: string;
  }): Promise<VirtualAccountStatusResult> {
    if (!input.providerAccountId && !input.providerReference) {
      return { status: VirtualAccountStatus.REQUIRES_RETRY };
    }
    const locator = input.providerAccountId
      ? `/virtual-account-numbers/${encodeURIComponent(input.providerAccountId)}`
      : `/virtual-account-numbers?reference=${encodeURIComponent(input.providerReference as string)}`;
    try {
      const response = await this.client.get<{ data?: Record<string, unknown> }>(locator);
      const data = response.data?.data ?? {};
      const active = Boolean(data.account_number ?? data.accountNumber);
      return {
        status: active ? VirtualAccountStatus.ACTIVE : VirtualAccountStatus.PENDING,
        providerReference:
          (data.order_ref as string | undefined) ??
          (data.flw_ref as string | undefined) ??
          input.providerReference,
        providerAccountId: data.id != null ? String(data.id) : input.providerAccountId,
        rawProviderResponse: data,
      };
    } catch {
      return { status: VirtualAccountStatus.REQUIRES_RETRY };
    }
  }

  async maybeDeactivateVirtualAccount(input: { providerAccountId: string }): Promise<void> {
    try {
      await this.client.post(`/virtual-account-numbers/${encodeURIComponent(input.providerAccountId)}/deactivate`);
    } catch (error) {
      this.logger.warn(`Virtual account deactivate request failed: ${String(error)}`);
    }
  }
}
