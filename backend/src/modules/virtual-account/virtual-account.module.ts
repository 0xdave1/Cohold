import { Module } from '@nestjs/common';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { AuthModule } from '../auth/auth.module';
import { KycComplianceModule } from '../kyc/kyc-compliance.module';

@Module({
  imports: [AuthModule, KycComplianceModule],
  controllers: [VirtualAccountController],
  providers: [VirtualAccountService],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
