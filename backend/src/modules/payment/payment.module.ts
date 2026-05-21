import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsPaystackWebhookController } from './payments-paystack-webhook.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { PaystackProvider } from './providers/paystack.provider';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycComplianceModule } from '../kyc/kyc-compliance.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';

@Module({
  imports: [WalletModule, AuthModule, NotificationsModule, KycComplianceModule, VirtualAccountModule],
  controllers: [PaymentsController, PaymentsPaystackWebhookController],
  providers: [PaymentService, PaystackProvider],
  exports: [PaymentService, PaystackProvider],
})
export class PaymentModule {}
