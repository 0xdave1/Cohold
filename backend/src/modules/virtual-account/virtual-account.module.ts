import { Module } from '@nestjs/common';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { PaystackVirtualAccountProvider } from './paystack-virtual-account.provider';
import { VIRTUAL_ACCOUNT_PROVIDER } from './virtual-account-provider.interface';
import { KycComplianceModule } from '../kyc/kyc-compliance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaystackProvider } from '../payment/providers/paystack.provider';

@Module({
  imports: [KycComplianceModule, NotificationsModule],
  controllers: [VirtualAccountController],
  providers: [
    VirtualAccountService,
    PaystackProvider,
    PaystackVirtualAccountProvider,
    { provide: VIRTUAL_ACCOUNT_PROVIDER, useExisting: PaystackVirtualAccountProvider },
  ],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
