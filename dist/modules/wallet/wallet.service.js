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
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const decimal_util_1 = require("../../common/money/decimal.util");
let WalletService = class WalletService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBalances(userId) {
        const wallets = await this.prisma.wallet.findMany({
            where: { userId },
            select: {
                id: true,
                currency: true,
                balance: true,
            },
        });
        return wallets.map((w) => ({
            id: w.id,
            currency: w.currency,
            balance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(w.balance.toString())),
        }));
    }
    async topUp(userId, dto) {
        const amount = (0, decimal_util_1.toDecimal)(dto.amount);
        if (amount.lte(0)) {
            throw new common_1.BadRequestException('Amount must be positive');
        }
        const wallet = await this.prisma.wallet.findFirst({
            where: { userId, currency: dto.currency },
        });
        if (!wallet) {
            throw new common_1.NotFoundException('Wallet not found for currency');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const currentBalance = (0, decimal_util_1.toDecimal)(wallet.balance.toString());
            const updatedWallet = await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: currentBalance.plus(amount),
                },
            });
            const transaction = await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    reference: dto.clientReference ?? `TOPUP-${Date.now()}-${wallet.id}`,
                    externalReference: null,
                    type: client_1.TransactionType.WALLET_TOP_UP,
                    status: client_1.TransactionStatus.COMPLETED,
                    amount,
                    currency: dto.currency,
                    direction: client_1.TransactionDirection.CREDIT,
                    metadata: {
                        reason: dto.reason ?? 'manual_or_alt_rail_topup',
                    },
                },
            });
            return { updatedWallet, transaction };
        });
        return {
            walletId: result.updatedWallet.id,
            currency: result.updatedWallet.currency,
            balance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedWallet.balance.toString())),
            transactionReference: result.transaction.reference,
        };
    }
    async swap(userId, dto) {
        if (dto.fromCurrency === dto.toCurrency) {
            throw new common_1.BadRequestException('Cannot swap the same currency');
        }
        const amount = (0, decimal_util_1.toDecimal)(dto.amount);
        if (amount.lte(0)) {
            throw new common_1.BadRequestException('Amount must be positive');
        }
        const [fromWallet, toWallet] = await Promise.all([
            this.prisma.wallet.findFirst({
                where: { userId, currency: dto.fromCurrency },
            }),
            this.prisma.wallet.findFirst({
                where: { userId, currency: dto.toCurrency },
            }),
        ]);
        if (!fromWallet || !toWallet) {
            throw new common_1.NotFoundException('Wallets for swap not found');
        }
        const fxRate = (0, decimal_util_1.toDecimal)(1);
        const toAmount = amount.mul(fxRate);
        const fee = dto.fromCurrency === client_1.Currency.NGN || dto.toCurrency === client_1.Currency.NGN
            ? (0, decimal_util_1.toDecimal)('100')
            : (0, decimal_util_1.toDecimal)('0');
        const totalDebit = amount.plus(fee);
        if ((0, decimal_util_1.toDecimal)(fromWallet.balance.toString()).lt(totalDebit)) {
            throw new common_1.BadRequestException('Insufficient balance for swap including fee');
        }
        const referenceBase = dto.clientReference ?? `SWAP-${Date.now()}-${userId}`;
        const result = await this.prisma.$transaction(async (tx) => {
            const updatedFromWallet = await tx.wallet.update({
                where: { id: fromWallet.id },
                data: {
                    balance: (0, decimal_util_1.toDecimal)(fromWallet.balance.toString()).minus(totalDebit),
                },
            });
            const updatedToWallet = await tx.wallet.update({
                where: { id: toWallet.id },
                data: {
                    balance: (0, decimal_util_1.toDecimal)(toWallet.balance.toString()).plus(toAmount),
                },
            });
            const swapTxRef = `${referenceBase}-MAIN`;
            const feeTxRef = `${referenceBase}-FEE`;
            await tx.transaction.createMany({
                data: [
                    {
                        walletId: fromWallet.id,
                        userId,
                        reference: swapTxRef,
                        externalReference: null,
                        type: client_1.TransactionType.WALLET_SWAP,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount,
                        currency: dto.fromCurrency,
                        direction: client_1.TransactionDirection.DEBIT,
                        metadata: {
                            toCurrency: dto.toCurrency,
                        },
                    },
                    {
                        walletId: toWallet.id,
                        userId,
                        reference: `${referenceBase}-CREDIT`,
                        externalReference: null,
                        type: client_1.TransactionType.WALLET_SWAP,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount: toAmount,
                        currency: dto.toCurrency,
                        direction: client_1.TransactionDirection.CREDIT,
                        metadata: {
                            fromCurrency: dto.fromCurrency,
                        },
                    },
                    {
                        walletId: fromWallet.id,
                        userId,
                        reference: feeTxRef,
                        externalReference: null,
                        type: client_1.TransactionType.FEE,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount: fee,
                        currency: client_1.Currency.NGN,
                        direction: client_1.TransactionDirection.DEBIT,
                        metadata: {
                            feeType: 'SWAP_PROCESSING_FEE',
                        },
                    },
                ],
            });
            return { updatedFromWallet, updatedToWallet, fee };
        });
        return {
            fromCurrency: dto.fromCurrency,
            toCurrency: dto.toCurrency,
            amount: (0, decimal_util_1.formatMoney)(amount),
            receivedAmount: (0, decimal_util_1.formatMoney)(toAmount),
            fee: (0, decimal_util_1.formatMoney)(result.fee),
            before: {
                fromBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(fromWallet.balance.toString())),
                toBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(toWallet.balance.toString())),
            },
            after: {
                fromBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedFromWallet.balance.toString())),
                toBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedToWallet.balance.toString())),
            },
        };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map