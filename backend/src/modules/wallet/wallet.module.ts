import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { FxModule } from '../fx/fx.module';
import { VirtualAccountModule } from '../virtual-account/virtual-account.module';
import { WalletAccountController } from './wallet-account.controller';
import { TransactionReceiptController } from './transaction-receipt.controller';

@Module({
  imports: [AuthModule, FxModule, VirtualAccountModule],
  controllers: [WalletController, WalletAccountController, TransactionReceiptController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

