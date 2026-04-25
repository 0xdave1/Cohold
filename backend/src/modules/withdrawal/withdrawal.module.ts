import { Module } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WithdrawalThrottleGuard } from './guards/withdrawal-throttle.guard';
import { PayoutModule } from '../payout/payout.module';

@Module({
  imports: [PrismaModule, NotificationsModule, PayoutModule],
  controllers: [WithdrawalController],
  providers: [WithdrawalService, WithdrawalThrottleGuard],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
