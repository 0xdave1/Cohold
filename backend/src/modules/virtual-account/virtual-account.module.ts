import { Module } from '@nestjs/common';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccountController } from './virtual-account.controller';
import { AuthModule } from '../auth/auth.module';
import { KycComplianceModule } from '../kyc/kyc-compliance.module';
import { FlutterwaveVirtualAccountProvider } from './flutterwave-virtual-account.provider';
import { VIRTUAL_ACCOUNT_PROVIDER } from './virtual-account-provider.interface';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, KycComplianceModule, NotificationsModule],
  controllers: [VirtualAccountController],
  providers: [
    VirtualAccountService,
    FlutterwaveVirtualAccountProvider,
    { provide: VIRTUAL_ACCOUNT_PROVIDER, useExisting: FlutterwaveVirtualAccountProvider },
  ],
  exports: [VirtualAccountService],
})
export class VirtualAccountModule {}
