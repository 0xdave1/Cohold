"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const admin_auth_module_1 = require("./modules/admin-auth/admin-auth.module");
const users_module_1 = require("./modules/users/users.module");
const wallet_module_1 = require("./modules/wallet/wallet.module");
const payment_module_1 = require("./modules/payment/payment.module");
const investment_module_1 = require("./modules/investment/investment.module");
const property_module_1 = require("./modules/property/property.module");
const kyc_module_1 = require("./modules/kyc/kyc.module");
const transfer_module_1 = require("./modules/transfer/transfer.module");
const admin_module_1 = require("./modules/admin/admin.module");
const webhook_module_1 = require("./modules/webhook/webhook.module");
const queue_module_1 = require("./modules/queue/queue.module");
const cache_module_1 = require("./modules/cache/cache.module");
const search_module_1 = require("./modules/search/search.module");
const gateway_module_1 = require("./modules/gateway/gateway.module");
const configuration_1 = require("./config/configuration");
const validation_1 = require("./config/validation");
const throttler_1 = require("@nestjs/throttler");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
                validationSchema: validation_1.validationSchema,
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            cache_module_1.CacheModule,
            queue_module_1.QueueModule,
            search_module_1.SearchModule,
            gateway_module_1.GatewayModule,
            auth_module_1.AuthModule,
            admin_auth_module_1.AdminAuthModule,
            users_module_1.UsersModule,
            wallet_module_1.WalletModule,
            payment_module_1.PaymentModule,
            investment_module_1.InvestmentModule,
            property_module_1.PropertyModule,
            kyc_module_1.KycModule,
            transfer_module_1.TransferModule,
            admin_module_1.AdminModule,
            webhook_module_1.WebhookModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map