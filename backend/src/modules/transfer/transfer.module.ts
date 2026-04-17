import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}

