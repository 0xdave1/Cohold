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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_util_1 = require("../../common/money/decimal.util");
const client_1 = require("@prisma/client");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardOverview() {
        const [totalInvestmentsAmount, usersCount, activeInvestorsCount, properties] = await Promise.all([
            this.prisma.investment.aggregate({
                _sum: { amount: true },
            }),
            this.prisma.user.count(),
            this.prisma.investment
                .groupBy({
                by: ['userId'],
            })
                .then((rows) => rows.length),
            this.prisma.property.findMany({
                select: {
                    id: true,
                    title: true,
                    status: true,
                    currentRaised: true,
                    totalValue: true,
                },
            }),
        ]);
        const totalAum = totalInvestmentsAmount._sum.amount
            ? (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(totalInvestmentsAmount._sum.amount.toString()))
            : '0.0000';
        return {
            totalAum,
            usersCount,
            activeInvestorsCount,
            properties,
        };
    }
    async listUsers(params) {
        const { page, limit, kycStatus } = params;
        const skip = (page - 1) * limit;
        const where = {};
        if (kycStatus) {
            where.kycStatus = kycStatus;
        }
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    kycStatus: true,
                    createdAt: true,
                },
            }),
            this.prisma.user.count({ where }),
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
    async createDistributionBatch(adminId, propertyId, totalAmountStr, currency) {
        const totalAmount = (0, decimal_util_1.toDecimal)(totalAmountStr);
        if (totalAmount.lte(0)) {
            throw new Error('Total amount must be positive');
        }
        const property = await this.prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!property) {
            throw new Error('Property not found');
        }
        const investments = await this.prisma.investment.findMany({
            where: { propertyId, status: client_1.InvestmentStatus.ACTIVE },
        });
        const totalShares = investments.reduce((acc, inv) => acc.plus((0, decimal_util_1.toDecimal)(inv.shares.toString())), (0, decimal_util_1.toDecimal)(0));
        const distribution = await this.prisma.$transaction(async (tx) => {
            const distributionRecord = await tx.distribution.create({
                data: {
                    propertyId,
                    totalAmount,
                    currency,
                    status: client_1.DistributionStatus.PENDING,
                    executedById: adminId,
                },
            });
            for (const inv of investments) {
                const investorShare = totalAmount.mul((0, decimal_util_1.toDecimal)(inv.shares.toString()).div(totalShares));
                const wallet = await tx.wallet.findFirst({
                    where: { userId: inv.userId, currency },
                });
                if (!wallet) {
                    continue;
                }
                await tx.wallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: (0, decimal_util_1.toDecimal)(wallet.balance.toString()).plus(investorShare),
                    },
                });
                await tx.transaction.create({
                    data: {
                        walletId: wallet.id,
                        userId: inv.userId,
                        reference: `DIST-${distributionRecord.id}-${inv.id}`,
                        externalReference: null,
                        type: client_1.TransactionType.DISTRIBUTION,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount: investorShare,
                        currency,
                        direction: client_1.TransactionDirection.CREDIT,
                        metadata: {
                            propertyId,
                            distributionId: distributionRecord.id,
                        },
                    },
                });
            }
            await tx.distribution.update({
                where: { id: distributionRecord.id },
                data: { status: client_1.DistributionStatus.COMPLETED },
            });
            await tx.adminActivityLog.create({
                data: {
                    adminId,
                    action: 'DISTRIBUTION_BATCH',
                    entityType: 'Distribution',
                    entityId: distributionRecord.id,
                },
            });
            return distributionRecord;
        });
        return distribution;
    }
    async getComplianceReport() {
        const highValueTransfers = await this.prisma.transaction.findMany({
            where: {
                type: client_1.TransactionType.P2P_TRANSFER,
                amount: {
                    gt: (0, decimal_util_1.toDecimal)('1000000'),
                },
            },
            take: 100,
        });
        return {
            highValueTransfers,
        };
    }
    async getActivityLog(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.adminActivityLog.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.adminActivityLog.count(),
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
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map