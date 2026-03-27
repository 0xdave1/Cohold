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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_util_1 = require("../../common/money/decimal.util");
const client_1 = require("@prisma/client");
let InvestmentService = class InvestmentService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createFractional(userId, dto) {
        const amount = (0, decimal_util_1.toDecimal)(dto.amount);
        if (amount.lte(0)) {
            throw new common_1.BadRequestException('Amount must be positive');
        }
        const property = await this.prisma.property.findUnique({
            where: { id: dto.propertyId },
        });
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.status !== 'PUBLISHED') {
            throw new common_1.BadRequestException('Property is not open for investment');
        }
        if (property.currency !== dto.currency) {
            throw new common_1.BadRequestException('Currency mismatch with property');
        }
        const wallet = await this.prisma.wallet.findFirst({
            where: { userId, currency: dto.currency },
        });
        if (!wallet) {
            throw new common_1.NotFoundException('Wallet not found for investment currency');
        }
        const walletBalance = (0, decimal_util_1.toDecimal)(wallet.balance.toString());
        if (walletBalance.lt(amount)) {
            throw new common_1.BadRequestException('Insufficient wallet balance');
        }
        const sharePrice = (0, decimal_util_1.toDecimal)(property.totalValue.toString()).div((0, decimal_util_1.toDecimal)(property.sharesTotal.toString()));
        const shares = amount.div(sharePrice);
        const result = await this.prisma.$transaction(async (tx) => {
            const lockedProperty = await tx.property.findUnique({
                where: { id: property.id },
            });
            if (!lockedProperty) {
                throw new common_1.NotFoundException('Property not found');
            }
            const existingSharesSold = (0, decimal_util_1.toDecimal)(lockedProperty.sharesSold.toString());
            const newSharesSold = existingSharesSold.plus(shares);
            if (newSharesSold.gt((0, decimal_util_1.toDecimal)(lockedProperty.sharesTotal.toString()))) {
                throw new common_1.BadRequestException('Not enough shares remaining');
            }
            const updatedWallet = await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: walletBalance.minus(amount),
                },
            });
            const investment = await tx.investment.create({
                data: {
                    userId,
                    propertyId: property.id,
                    amount,
                    currency: dto.currency,
                    shares,
                    status: client_1.InvestmentStatus.ACTIVE,
                },
            });
            await tx.property.update({
                where: { id: property.id },
                data: {
                    sharesSold: newSharesSold,
                    currentRaised: (0, decimal_util_1.toDecimal)(lockedProperty.currentRaised.toString()).plus(amount),
                },
            });
            await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    reference: dto.clientReference,
                    externalReference: null,
                    type: client_1.TransactionType.INVESTMENT,
                    status: client_1.TransactionStatus.COMPLETED,
                    amount,
                    currency: dto.currency,
                    direction: client_1.TransactionDirection.DEBIT,
                    metadata: {
                        propertyId: property.id,
                        investmentId: investment.id,
                    },
                },
            });
            return { investment, updatedWallet, propertyId: property.id };
        });
        return {
            investmentId: result.investment.id,
            propertyId: result.propertyId,
            amount: (0, decimal_util_1.formatMoney)(amount),
            currency: dto.currency,
            shares: (0, decimal_util_1.formatHighPrecision)((0, decimal_util_1.toDecimal)(result.investment.shares.toString())),
            walletBalanceAfter: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedWallet.balance.toString())),
        };
    }
    async getInvestment(id) {
        const investment = await this.prisma.investment.findUnique({
            where: { id },
            include: {
                property: true,
            },
        });
        if (!investment) {
            throw new common_1.NotFoundException('Investment not found');
        }
        return investment;
    }
    async getInvestmentsByUser(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.investment.findMany({
                where: { userId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.investment.count({ where: { userId } }),
        ]);
        return {
            items,
            meta: {
                page,
                limit,
                total,
            },
        };
    }
};
exports.InvestmentService = InvestmentService;
exports.InvestmentService = InvestmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvestmentService);
//# sourceMappingURL=investment.service.js.map