import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { DistributionService } from './distribution.service';
import { DistributionController } from './distribution.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { DistributionUserController } from './distribution.user.controller';

@Module({
  imports: [AuthModule, WalletModule, NotificationsModule],
  controllers: [DistributionController, DistributionUserController],
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}
