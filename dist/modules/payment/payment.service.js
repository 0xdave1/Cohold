"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const wallet_service_1 = require("../wallet/wallet.service");
const client_1 = require("@prisma/client");
let PaymentService = PaymentService_1 = class PaymentService {
    constructor(prisma, walletService) {
        this.prisma = prisma;
        this.walletService = walletService;
        this.logger = new common_1.Logger(PaymentService_1.name);
    }
    async handlePaystackEvent(payload) {
        const event = payload.event;
        if (!event)
            return;
        switch (event) {
            case 'charge.success':
                await this.handleChargeSuccess(payload);
                break;
            default:
                this.logger.debug(`Unhandled Paystack event: ${event}`);
        }
    }
    async handleChargeSuccess(payload) {
        const data = payload.data;
        const reference = data?.reference;
        const amountKobo = data?.amount;
        const currencyCode = data?.currency;
        const customerEmail = data?.customer?.email;
        if (!reference || !amountKobo || !currencyCode) {
            this.logger.warn('charge.success missing critical fields');
            return;
        }
        const amount = (amountKobo / 100).toFixed(2);
        const user = await this.prisma.user.findUnique({
            where: { email: customerEmail },
        });
        if (!user) {
            this.logger.error(`User not found for charge.success email ${customerEmail}`);
            return;
        }
        const existingTx = await this.prisma.transaction.findUnique({
            where: { reference },
        });
        if (existingTx) {
            return;
        }
        await this.walletService.topUp(user.id, {
            currency: client_1.Currency.NGN,
            amount,
            clientReference: reference,
            reason: 'paystack_charge_success',
        });
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        wallet_service_1.WalletService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map