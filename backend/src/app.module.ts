import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InvestmentModule } from './modules/investment/investment.module';
import { PropertyModule } from './modules/property/property.module';
import { KycModule } from './modules/kyc/kyc.module';
import { VirtualAccountModule } from './modules/virtual-account/virtual-account.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { AdminModule } from './modules/admin/admin.module';
import { DistributionModule } from './modules/distribution/distribution.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { QueueModule } from './modules/queue/queue.module';

import { RedisModule } from './modules/redis/redis.module';
import { SearchModule } from './modules/search/search.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { EmailModule } from './modules/email/email.module';
import { StorageModule } from './modules/storage/storage.module';
import { FxModule } from './modules/fx/fx.module';
import { SupportModule } from './modules/support/support.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WithdrawalModule } from './modules/withdrawal/withdrawal.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CsrfGuard } from './common/guards/csrf.guard';
// Auth guards are applied at controller level to avoid mixing user/admin tokens globally.

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
 
    QueueModule,
    SearchModule,
    GatewayModule,
    EmailModule,
    StorageModule,
    FxModule,
    // Domain modules
    AuthModule,
    AdminAuthModule,
    SupportModule,
    NotificationsModule,
    WithdrawalModule,
    UsersModule,
    WalletModule,
    PaymentModule,
    InvestmentModule,
    PropertyModule,
    KycModule,
    VirtualAccountModule,
    TransferModule,
    AdminModule,
    DistributionModule,
    WebhookModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}

