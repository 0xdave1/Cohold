import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentModule } from '../payment/payment.module';
import { WithdrawalModule } from '../withdrawal/withdrawal.module';
import { PayoutModule } from '../payout/payout.module';

@Module({
  imports: [PaymentModule, WithdrawalModule, PayoutModule],
  controllers: [WebhookController],
})
export class WebhookModule {}

