import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import { Inject } from '@nestjs/common';
import { PAYOUT_PROVIDER, PayoutProvider } from '../payout/payout-provider.interface';

@Controller('flutterwave')
export class WebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly withdrawalService: WithdrawalService,
    @Inject(PAYOUT_PROVIDER) private readonly payoutProvider: PayoutProvider,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleFlutterwaveWebhook(
    @Headers('verif-hash') signature: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    if (!signature || !this.payoutProvider.verifyWebhookSignature(headers)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }
    const parsedTransfer = this.payoutProvider.parseTransferWebhook(payload);
    if (parsedTransfer) {
      return this.withdrawalService.handlePayoutWebhook(payload);
    }
    return this.paymentService.handleFlutterwaveWebhook(payload);
  }
}
