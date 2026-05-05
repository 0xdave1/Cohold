import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { WithdrawalModule } from '../withdrawal/withdrawal.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [AuthModule, WithdrawalModule, KycModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

