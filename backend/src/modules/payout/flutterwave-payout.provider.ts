import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  InitiateTransferInput,
  InitiateTransferResult,
  ParsedTransferWebhook,
  PayoutProvider,
  ResolveBankAccountInput,
  ResolveBankAccountResult,
  SupportedBank,
  TransferPollResult,
} from './payout-provider.interface';

@Injectable()
export class FlutterwavePayoutProvider implements PayoutProvider {
  private readonly logger = new Logger(FlutterwavePayoutProvider.name);
  private readonly client: AxiosInstance;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.get<string>('config.flutterwave.secretKey') ??
      this.configService.get<string>('FLW_SECRET_KEY') ??
      this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') ??
      '';
    const baseUrl =
      this.configService.get<string>('config.flutterwave.baseUrl') ??
      this.configService.get<string>('FLW_BASE_URL') ??
      this.configService.get<string>('FLUTTERWAVE_BASE_URL') ??
      'https://api.flutterwave.com/v3';
    this.webhookSecret =
      this.configService.get<string>('config.flutterwave.webhookSecret') ??
      this.configService.get<string>('FLW_WEBHOOK_SECRET') ??
      this.configService.get<string>('FLUTTERWAVE_WEBHOOK_SECRET') ??
      '';

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolveBankAccountResult> {
    if (input.currency !== 'NGN') {
      throw new BadRequestException('Only NGN linked banks are supported');
    }
    try {
      const response = await this.client.get<{
        status: string;
        data?: {
          account_number?: string;
          account_name?: string;
          bank_code?: string;
          bank_name?: string;
        };
      }>('/accounts/resolve', {
        params: {
          account_number: input.accountNumber,
          account_bank: input.bankCode,
        },
      });
      const data = response.data?.data;
      if (!data?.account_name || !data?.account_number) {
        throw new UnprocessableEntityException('Unable to verify bank account details');
      }
      return {
        accountNumber: String(data.account_number),
        accountName: String(data.account_name).trim(),
        bankCode: String(data.bank_code ?? input.bankCode),
        bankName: String(data.bank_name ?? '').trim() || `Bank ${input.bankCode}`,
        currency: 'NGN',
        isVerified: true,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(`Bank resolve failed: ${error.message}`);
        throw new BadRequestException(
          error.response?.data?.message ?? 'Failed to verify bank account',
        );
      }
      throw error;
    }
  }

  async listSupportedBanks(_currency: 'NGN'): Promise<SupportedBank[]> {
    const response = await this.client.get<{
      status: string;
      data?: Array<{ code?: string; name?: string }>;
    }>('/banks/NG');
    const items = response.data?.data ?? [];
    return items
      .filter((bank) => bank.code && bank.name)
      .map((bank) => ({ code: String(bank.code), name: String(bank.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private isAmbiguousAxiosError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return true;
    const status = error.response?.status;
    if (status == null) return true;
    if (status >= 500) return true;
    return false;
  }

  private mapDataStatusToInitiateResult(
    data: {
      id?: number | string;
      reference?: string;
      status?: string;
      complete_message?: string | null;
    } | undefined,
    input: InitiateTransferInput,
    apiMessage?: string,
  ): InitiateTransferResult {
    const rawStatus = String(data?.status ?? '').toLowerCase();
    const normalized =
      rawStatus === 'successful'
        ? 'PROCESSING'
        : rawStatus === 'failed' || rawStatus === 'rejected'
          ? 'FAILED'
          : 'PROCESSING';

    return {
      accepted: normalized !== 'FAILED',
      providerReference: data?.reference ? String(data.reference) : input.reference,
      transferCode: data?.id != null ? String(data.id) : null,
      status: normalized,
      rawStatus: rawStatus || null,
      ambiguous: false,
      failureReason:
        normalized === 'FAILED'
          ? String(data?.complete_message ?? apiMessage ?? 'Transfer rejected')
          : null,
    };
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    try {
      const response = await this.client.post<{
        status: string;
        message?: string;
        data?: {
          id?: number | string;
          reference?: string;
          status?: string;
          complete_message?: string | null;
        };
      }>('/transfers', {
        account_bank: input.bankCode,
        account_number: input.accountNumber,
        amount: Number(input.amount),
        narration: input.narration,
        currency: input.currency,
        reference: input.reference,
        debit_currency: input.currency,
      });

      const data = response.data?.data;
      if (response.data?.status !== 'success' && response.data?.status !== 'SUCCESS') {
        const msg = String(response.data?.message ?? 'Transfer initiation returned non-success');
        return {
          accepted: false,
          providerReference: input.reference,
          transferCode: data?.id != null ? String(data.id) : null,
          status: 'FAILED',
          rawStatus: String(data?.status ?? ''),
          ambiguous: false,
          failureReason: msg,
        };
      }
      return this.mapDataStatusToInitiateResult(data, input, response.data?.message);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const ambiguous = this.isAmbiguousAxiosError(error);
        if (ambiguous) {
          return {
            accepted: false,
            providerReference: input.reference,
            transferCode: null,
            status: 'UNKNOWN',
            rawStatus: null,
            ambiguous: true,
            failureReason: error.message || 'Provider transfer initiation unreachable',
          };
        }
        return {
          accepted: false,
          providerReference: input.reference,
          transferCode: null,
          status: 'FAILED',
          rawStatus: null,
          ambiguous: false,
          failureReason:
            (error.response?.data as { message?: string } | undefined)?.message ??
            'Provider transfer initiation failed',
        };
      }
      throw error;
    }
  }

  async getTransferStatus(transferId: string): Promise<TransferPollResult> {
    try {
      const response = await this.client.get<{
        status: string;
        message?: string;
        data?: {
          id?: number | string;
          reference?: string;
          status?: string;
          complete_message?: string | null;
        };
      }>(`/transfers/${encodeURIComponent(transferId)}`);

      const data = response.data?.data;
      const rawStatus = String(data?.status ?? '').toUpperCase();
      let status: TransferPollResult['status'] = 'UNKNOWN';
      if (rawStatus === 'SUCCESSFUL') status = 'SUCCESS';
      else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED') status = 'FAILED';
      else if (
        rawStatus === 'NEW' ||
        rawStatus === 'PENDING' ||
        rawStatus === 'PROCESSING' ||
        rawStatus === 'PENDING_APPROVAL'
      ) {
        status = 'PROCESSING';
      }

      return {
        status,
        providerReference: data?.reference ? String(data.reference) : null,
        transferCode: data?.id != null ? String(data.id) : transferId,
        rawStatus: rawStatus || null,
        ambiguous: false,
        failureReason:
          status === 'FAILED'
            ? String(data?.complete_message ?? response.data?.message ?? 'Transfer failed')
            : null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: 'UNKNOWN',
          providerReference: null,
          transferCode: transferId,
          rawStatus: null,
          ambiguous: this.isAmbiguousAxiosError(error),
          failureReason: error.message || 'Transfer status poll failed',
        };
      }
      throw error;
    }
  }

  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    _rawBody?: Buffer | string,
  ): boolean {
    const verifHash =
      headers['verif-hash'] ??
      headers['Verif-Hash'] ??
      headers['verif_hash'] ??
      headers['Verif_Hash'];
    const signature = Array.isArray(verifHash) ? verifHash[0] : verifHash;
    return Boolean(signature && this.webhookSecret && signature === this.webhookSecret);
  }

  parseTransferWebhook(payload: Record<string, unknown>): ParsedTransferWebhook | null {
    const eventType = String(payload?.event ?? '');
    if (!eventType.toLowerCase().includes('transfer')) {
      return null;
    }
    const data = (payload?.data as Record<string, unknown>) ?? {};
    const statusRaw = String(data?.status ?? '').toLowerCase();
    const mappedStatus: ParsedTransferWebhook['status'] =
      statusRaw === 'successful'
        ? 'SUCCESS'
        : statusRaw === 'failed' || statusRaw === 'rejected'
          ? 'FAILED'
          : statusRaw === 'pending' || statusRaw === 'processing'
            ? 'PROCESSING'
            : 'UNKNOWN';

    return {
      eventType,
      providerReference: data?.reference ? String(data.reference) : null,
      transferCode: data?.id != null ? String(data.id) : null,
      status: mappedStatus,
      failureReason:
        mappedStatus === 'FAILED'
          ? String(data?.complete_message ?? data?.narration ?? 'Transfer failed')
          : null,
    };
  }
}
