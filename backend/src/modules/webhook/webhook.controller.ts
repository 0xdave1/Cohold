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
import { ConfigService } from '@nestjs/config';
import { PaymentService } from '../payment/payment.service';

@Controller('flutterwave')
export class WebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleFlutterwaveWebhook(
    @Headers('verif-hash') signature: string,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    const webhookSecret =
      this.configService.get<string>('config.flutterwave.webhookSecret') ??
      this.configService.get<string>('FLW_WEBHOOK_SECRET');

    if (!signature || !webhookSecret || signature !== webhookSecret) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    return this.paymentService.handleFlutterwaveWebhook(payload);
  }
}
