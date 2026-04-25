import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvestmentService } from './investment.service';
import { InvestmentController } from './investment.controller';

@Module({
  imports: [AuthModule, WalletModule, forwardRef(() => PaymentModule), NotificationsModule],
  controllers: [InvestmentController],
  providers: [InvestmentService],
  exports: [InvestmentService],
})
export class InvestmentModule {}

