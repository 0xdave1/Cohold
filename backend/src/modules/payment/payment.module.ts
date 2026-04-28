import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { InvestmentModule } from '../investment/investment.module';
import { AuthModule } from '../auth/auth.module';
import { FlutterwaveService } from './flutterwave.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WalletModule, forwardRef(() => InvestmentModule), AuthModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentService, FlutterwaveService],
  exports: [PaymentService, FlutterwaveService],
})
export class PaymentModule {}

