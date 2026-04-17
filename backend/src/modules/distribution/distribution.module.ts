import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { InvestmentModule } from '../investment/investment.module';
import { DistributionService } from './distribution.service';
import { DistributionController } from './distribution.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, WalletModule, InvestmentModule, NotificationsModule],
  controllers: [DistributionController],
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}
