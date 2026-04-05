import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaystackController } from './paystack.controller';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { InvestmentModule } from '../investment/investment.module';
import { PaystackModule } from '../paystack/paystack.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WalletModule, PaystackModule, forwardRef(() => InvestmentModule), AuthModule, NotificationsModule],
  controllers: [PaystackController, PaymentsController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}

