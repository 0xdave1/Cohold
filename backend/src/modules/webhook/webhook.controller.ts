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
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER, PayoutProvider } from '../payout/payout-provider.interface';
import { FlutterwaveWebhookDto } from './dto/flutterwave-webhook.dto';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly withdrawalService: WithdrawalService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
  ) {}

  @Post('flutterwave')
  @SkipThrottle()
  async handleFlutterwaveWebhook(
    @Headers('verif-hash') signature: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() payload: FlutterwaveWebhookDto,
  ): Promise<{ received: boolean }> {
    const contentLength = Number(req.headers?.['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 1024 * 1024) {
      throw new PayloadTooLargeException('Webhook body too large');
    }
    if (req.rawBody && Buffer.byteLength(String(req.rawBody)) > 1024 * 1024) {
      throw new PayloadTooLargeException('Webhook body too large');
    }
    if (!signature || !this.payoutProvider.verifyWebhookSignature(headers, req.rawBody)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const raw = payload as unknown as Record<string, unknown>;
    const event = String(raw?.event ?? '').toLowerCase();
    if (event.includes('transfer')) {
      return this.withdrawalService.handlePayoutWebhook(raw);
    }
    return this.paymentService.handleFlutterwaveWebhook(raw);
  }
}
