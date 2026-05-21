import {
  Body,
  Controller,
  Headers,
  Inject,
  PayloadTooLargeException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER, PayoutProvider } from '../payout/payout-provider.interface';

/**
 * Paystack webhook URL: POST /api/v1/payments/paystack/webhook
 * (Legacy alias: POST /api/v1/webhooks/paystack)
 */
@Controller('payments/paystack')
export class PaymentsPaystackWebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly withdrawalService: WithdrawalService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
  ) {}

  @Post('webhook')
  @SkipThrottle()
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    const contentLength = Number(req.headers?.['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
      throw new PayloadTooLargeException('Webhook body too large');
    }
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    if (Buffer.byteLength(String(rawBody)) > 1024 * 1024) {
      throw new PayloadTooLargeException('Webhook body too large');
    }
    if (!this.payoutProvider.verifyWebhookSignature(headers, rawBody)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = String(payload?.event ?? '').toLowerCase();
    if (event.startsWith('transfer.')) {
      return this.withdrawalService.handlePayoutWebhook(payload);
    }
    return this.paymentService.handlePaystackWebhook(payload);
  }
}
