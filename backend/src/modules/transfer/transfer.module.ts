import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransferService } from './transfer.service';
import { TransferController } from './transfer.controller';

@Module({
  imports: [AuthModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}

