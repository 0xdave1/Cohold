import { Module } from '@nestjs/common';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { AuthModule } from '../auth/auth.module';
import { PaystackModule } from '../paystack/paystack.module';

@Module({
  imports: [AuthModule, PaystackModule],
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
