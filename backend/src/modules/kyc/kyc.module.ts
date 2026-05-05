import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { StorageModule } from '../storage/storage.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { EmailModule } from '../email/email.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycComplianceModule } from './kyc-compliance.module';

@Module({
  imports: [
    KycComplianceModule,
    AuthModule,
    StorageModule,
    VirtualAccountModule,
    EmailModule,
    WalletModule,
    NotificationsModule,
  ],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService, KycComplianceModule],
})
export class KycModule {}

