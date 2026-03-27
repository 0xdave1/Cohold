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
exports.TransferService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_util_1 = require("../../common/money/decimal.util");
const client_1 = require("@prisma/client");
let TransferService = class TransferService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async p2pTransfer(senderId, dto) {
        if (!dto.recipientHandle.startsWith('@')) {
            throw new common_1.BadRequestException('Recipient handle must start with @');
        }
        const username = dto.recipientHandle.slice(1);
        const [sender, recipient] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: senderId } }),
            this.prisma.user.findUnique({ where: { username } }),
        ]);
        if (!sender) {
            throw new common_1.NotFoundException('Sender not found');
        }
        if (!recipient) {
            throw new common_1.NotFoundException('Recipient not found');
        }
        const amount = (0, decimal_util_1.toDecimal)(dto.amount);
        if (amount.lte(0)) {
            throw new common_1.BadRequestException('Amount must be positive');
        }
        const [senderWallet, recipientWallet] = await Promise.all([
            this.prisma.wallet.findFirst({
                where: { userId: sender.id },
            }),
            this.prisma.wallet.findFirst({
                where: { userId: recipient.id },
            }),
        ]);
        if (!senderWallet || !recipientWallet) {
            throw new common_1.BadRequestException('Both users must have wallets');
        }
        if (senderWallet.currency !== recipientWallet.currency) {
            throw new common_1.BadRequestException('P2P transfer requires same-currency wallets for now');
        }
        const senderBalance = (0, decimal_util_1.toDecimal)(senderWallet.balance.toString());
        if (senderBalance.lt(amount)) {
            throw new common_1.BadRequestException('Insufficient balance');
        }
        const baseRef = dto.clientReference ?? `P2P-${Date.now()}-${senderId}`;
        const result = await this.prisma.$transaction(async (tx) => {
            const updatedSenderWallet = await tx.wallet.update({
                where: { id: senderWallet.id },
                data: {
                    balance: senderBalance.minus(amount),
                },
            });
            const updatedRecipientWallet = await tx.wallet.update({
                where: { id: recipientWallet.id },
                data: {
                    balance: (0, decimal_util_1.toDecimal)(recipientWallet.balance.toString()).plus(amount),
                },
            });
            await tx.transaction.createMany({
                data: [
                    {
                        walletId: senderWallet.id,
                        userId: sender.id,
                        reference: `${baseRef}-DEBIT`,
                        externalReference: null,
                        type: client_1.TransactionType.P2P_TRANSFER,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount,
                        currency: senderWallet.currency,
                        direction: client_1.TransactionDirection.DEBIT,
                        metadata: {
                            recipientId: recipient.id,
                            recipientHandle: dto.recipientHandle,
                        },
                    },
                    {
                        walletId: recipientWallet.id,
                        userId: recipient.id,
                        reference: `${baseRef}-CREDIT`,
                        externalReference: null,
                        type: client_1.TransactionType.P2P_TRANSFER,
                        status: client_1.TransactionStatus.COMPLETED,
                        amount,
                        currency: recipientWallet.currency,
                        direction: client_1.TransactionDirection.CREDIT,
                        metadata: {
                            senderId: sender.id,
                            senderUsername: sender.username,
                        },
                    },
                ],
            });
            return {
                updatedSenderWallet,
                updatedRecipientWallet,
            };
        });
        return {
            fromUserId: sender.id,
            toUserId: recipient.id,
            amount: (0, decimal_util_1.formatMoney)(amount),
            currency: senderWallet.currency,
            before: {
                senderBalance: (0, decimal_util_1.formatMoney)(senderBalance),
                recipientBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(recipientWallet.balance.toString())),
            },
            after: {
                senderBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedSenderWallet.balance.toString())),
                recipientBalance: (0, decimal_util_1.formatMoney)((0, decimal_util_1.toDecimal)(result.updatedRecipientWallet.balance.toString())),
            },
        };
    }
};
exports.TransferService = TransferService;
exports.TransferService = TransferService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TransferService);
//# sourceMappingURL=transfer.service.js.map