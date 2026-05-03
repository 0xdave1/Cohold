import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletService } from './wallet.service';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { WalletController } from './wallet.controller';
import { FxModule } from '../fx/fx.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { WalletAccountController } from './wallet-account.controller';
import { TransactionReceiptController } from './transaction-receipt.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, FxModule, VirtualAccountModule, NotificationsModule],
  controllers: [WalletController, WalletAccountController, TransactionReceiptController],
  providers: [WalletService, LedgerReconciliationService],
  exports: [WalletService, LedgerReconciliationService],
})
export class WalletModule {}

