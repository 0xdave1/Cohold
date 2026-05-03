import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { PAYOUT_PROVIDER, PayoutProvider } from '../payout/payout-provider.interface';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly withdrawalService: WithdrawalService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
  ) {}

  @Post('flutterwave')
  async handleFlutterwaveWebhook(
    @Headers('verif-hash') signature: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    if (!signature || !this.payoutProvider.verifyWebhookSignature(headers, req.rawBody)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = String(payload?.event ?? '').toLowerCase();
    if (event.includes('transfer')) {
      return this.withdrawalService.handlePayoutWebhook(payload);
    }
    return this.paymentService.handleFlutterwaveWebhook(payload);
  }
}
