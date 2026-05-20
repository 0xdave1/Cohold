import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { toDecimal } from '../../common/money/decimal.util';
import { PaystackProvider } from '../payment/providers/paystack.provider';
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
export class PaystackPayoutProvider implements PayoutProvider {
  private readonly recipientCache = new Map<string, string>();

  constructor(private readonly paystack: PaystackProvider) {}

  private transfersDisabledResult(input: InitiateTransferInput): InitiateTransferResult {
    return {
      accepted: false,
      providerReference: input.reference,
      transferCode: null,
      status: 'FAILED',
      rawStatus: 'disabled',
      ambiguous: false,
      failureReason: 'Paystack transfers are not enabled for this deployment.',
    };
  }

  async resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolveBankAccountResult> {
    if (input.currency !== 'NGN') {
      throw new BadRequestException('Only NGN linked banks are supported');
    }
    const resolved = await this.paystack.resolveBankAccount({
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
    });
    return {
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
      bankCode: input.bankCode,
      bankName: `Bank ${input.bankCode}`,
      currency: 'NGN',
      isVerified: true,
    };
  }

  async listSupportedBanks(_currency: 'NGN'): Promise<SupportedBank[]> {
    const banks = await this.paystack.listBanks();
    return banks.sort((a, b) => a.name.localeCompare(b.name));
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<InitiateTransferResult> {
    if (!this.paystack.isTransfersEnabled()) {
      return this.transfersDisabledResult(input);
    }

    const cacheKey = `${input.bankCode}:${input.accountNumber}`;
    let recipientCode = this.recipientCache.get(cacheKey);
    if (!recipientCode) {
      try {
        const recipient = await this.paystack.createTransferRecipient({
          accountNumber: input.accountNumber,
          bankCode: input.bankCode,
          name: input.accountName,
          currency: 'NGN',
        });
        recipientCode = recipient.recipientCode;
        this.recipientCache.set(cacheKey, recipientCode);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) {
          return this.transfersDisabledResult(input);
        }
        if (axios.isAxiosError(error)) {
          return {
            accepted: false,
            providerReference: input.reference,
            transferCode: null,
            status: 'FAILED',
            rawStatus: null,
            ambiguous: !error.response?.status || error.response.status >= 500,
            failureReason:
              (error.response?.data as { message?: string } | undefined)?.message ??
              'Paystack transfer recipient failed',
          };
        }
        throw error;
      }
    }

    try {
      const transfer = await this.paystack.initiateTransfer({
        recipientCode,
        amount: toDecimal(input.amount),
        reference: input.reference,
        reason: input.narration,
        currency: 'NGN',
      });

      const raw = transfer.status;
      const pendingOtp = raw === 'otp' || raw === 'pending' || raw === 'processing' || raw === 'queued';
      if (pendingOtp) {
        return {
          accepted: true,
          providerReference: transfer.reference,
          transferCode: transfer.transferCode,
          status: 'PROCESSING',
          rawStatus: raw,
          ambiguous: false,
          failureReason: null,
        };
      }
      if (raw === 'success') {
        return {
          accepted: true,
          providerReference: transfer.reference,
          transferCode: transfer.transferCode,
          status: 'PROCESSING',
          rawStatus: raw,
          ambiguous: false,
          failureReason: null,
        };
      }
      if (raw === 'failed' || raw === 'reversed') {
        return {
          accepted: false,
          providerReference: transfer.reference,
          transferCode: transfer.transferCode,
          status: 'FAILED',
          rawStatus: raw,
          ambiguous: false,
          failureReason: 'Paystack reported transfer failure',
        };
      }
      return {
        accepted: true,
        providerReference: transfer.reference,
        transferCode: transfer.transferCode,
        status: 'PROCESSING',
        rawStatus: raw,
        ambiguous: false,
        failureReason: null,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.transfersDisabledResult(input);
      }
      if (axios.isAxiosError(error)) {
        const ambiguous = !error.response?.status || error.response.status >= 500;
        return {
          accepted: false,
          providerReference: input.reference,
          transferCode: null,
          status: ambiguous ? 'UNKNOWN' : 'FAILED',
          rawStatus: null,
          ambiguous,
          failureReason:
            (error.response?.data as { message?: string } | undefined)?.message ??
            error.message ??
            'Paystack transfer initiation failed',
        };
      }
      throw error;
    }
  }

  async getTransferStatus(transferId: string): Promise<TransferPollResult> {
    if (!this.paystack.isTransfersEnabled()) {
      return {
        status: 'UNKNOWN',
        providerReference: null,
        transferCode: transferId,
        rawStatus: 'disabled',
        ambiguous: false,
        failureReason: 'Paystack transfers are not enabled',
      };
    }
    try {
      const snap = await this.paystack.getTransfer(transferId);
      const raw = snap.status;
      let status: TransferPollResult['status'] = 'UNKNOWN';
      if (raw === 'success') status = 'SUCCESS';
      else if (raw === 'failed' || raw === 'reversed') status = 'FAILED';
      else if (raw === 'pending' || raw === 'otp' || raw === 'processing' || raw === 'queued') {
        status = 'PROCESSING';
      }
      return {
        status,
        providerReference: snap.reference,
        transferCode: snap.transferCode,
        rawStatus: raw,
        ambiguous: false,
        failureReason: status === 'FAILED' ? snap.failureReason : null,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: 'UNKNOWN',
          providerReference: null,
          transferCode: transferId,
          rawStatus: null,
          ambiguous: !error.response?.status || error.response.status >= 500,
          failureReason: error.message || 'Paystack transfer status poll failed',
        };
      }
      throw error;
    }
  }

  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer | string,
  ): boolean {
    const sig =
      headers['x-paystack-signature'] ??
      headers['X-Paystack-Signature'] ??
      headers['x_paystack_signature'];
    const signature = Array.isArray(sig) ? sig[0] : sig;
    if (!rawBody || !signature) return false;
    return this.paystack.verifyWebhookSignature(rawBody, signature);
  }

  parseTransferWebhook(payload: Record<string, unknown>): ParsedTransferWebhook | null {
    const event = String(payload.event ?? '').toLowerCase();
    if (!event.startsWith('transfer.')) {
      return null;
    }
    const data = (payload.data as Record<string, unknown>) ?? {};
    const statusRaw = String(data.status ?? '').toLowerCase();
    let status: ParsedTransferWebhook['status'] = 'UNKNOWN';
    if (event === 'transfer.success' || statusRaw === 'success') status = 'SUCCESS';
    else if (event === 'transfer.failed' || statusRaw === 'failed') status = 'FAILED';
    else if (event === 'transfer.reversed' || statusRaw === 'reversed') status = 'FAILED';
    else if (statusRaw === 'pending' || statusRaw === 'otp' || statusRaw === 'processing') {
      status = 'PROCESSING';
    }

    return {
      eventType: event,
      providerReference: data.reference != null ? String(data.reference) : null,
      transferCode:
        data.transfer_code != null
          ? String(data.transfer_code)
          : data.id != null
            ? String(data.id)
            : null,
      status,
      failureReason:
        status === 'FAILED'
          ? String(data.reason ?? data.complete_message ?? 'Transfer failed')
          : null,
    };
  }
}
