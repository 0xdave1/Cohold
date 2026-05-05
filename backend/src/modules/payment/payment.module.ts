import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { FlutterwaveService } from './flutterwave.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycComplianceModule } from '../kyc/kyc-compliance.module';

@Module({
  imports: [WalletModule, AuthModule, NotificationsModule, KycComplianceModule],
  controllers: [PaymentsController],
  providers: [PaymentService, FlutterwaveService],
  exports: [PaymentService, FlutterwaveService],
})
export class PaymentModule {}

