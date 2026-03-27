import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from '../payment/payment.service';
import { PaystackService } from '../paystack/paystack.service';

/** Alias route: POST /webhook/paystack (same handler as /webhooks/paystack). */
@Controller('webhook')
export class PaystackWebhookAliasController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paystackService: PaystackService,
  ) {}

  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  async handlePaystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new UnauthorizedException('No signature provided');
    }

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || !rawBody.length) {
      throw new BadRequestException('Expected raw JSON body');
    }

    if (!this.paystackService.verifyWebhookSignature(signature, rawBody)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    await this.paymentService.handlePaystackEvent(payload);
    return { received: true };
  }
}
