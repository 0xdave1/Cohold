import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaystackWebhookAliasController } from './webhook-alias.controller';
import { PaymentModule } from '../payment/payment.module';
import { PaystackModule } from '../paystack/paystack.module';

@Module({
  imports: [PaymentModule, PaystackModule],
  controllers: [WebhookController, PaystackWebhookAliasController],
})
export class WebhookModule {}

