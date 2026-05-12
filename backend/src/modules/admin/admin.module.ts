import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { WithdrawalModule } from '../withdrawal/withdrawal.module';
import { KycModule } from '../kyc/kyc.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [AuthModule, WalletModule, WithdrawalModule, KycModule, VirtualAccountModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

