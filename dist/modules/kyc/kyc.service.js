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
exports.KycService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let KycService = class KycService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async submitBvn(userId, dto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.kycStatus === client_1.KycStatus.VERIFIED) {
            throw new common_1.BadRequestException('KYC already verified');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                bvn: dto.bvn,
                kycStatus: client_1.KycStatus.PENDING,
            },
        });
        await this.prisma.kycVerification.upsert({
            where: { userId },
            update: {
                status: client_1.KycStatus.PENDING,
            },
            create: {
                userId,
                status: client_1.KycStatus.PENDING,
            },
        });
        return { status: client_1.KycStatus.PENDING };
    }
    async approveKyc(adminId, userId, _dto) {
        const kyc = await this.prisma.kycVerification.findUnique({
            where: { userId },
        });
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const kycVerification = await tx.kycVerification.update({
                where: { userId },
                data: {
                    status: client_1.KycStatus.VERIFIED,
                    requiresReview: false,
                    failureReason: null,
                    reviewedById: adminId,
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { kycStatus: client_1.KycStatus.VERIFIED },
            });
            await tx.adminActivityLog.create({
                data: {
                    adminId,
                    action: 'KYC_APPROVE',
                    entityType: 'User',
                    entityId: userId,
                },
            });
            return kycVerification;
        });
        return updated;
    }
    async rejectKyc(adminId, userId, dto) {
        if (!dto.failureReason) {
            throw new common_1.BadRequestException('failureReason is required when rejecting');
        }
        const kyc = await this.prisma.kycVerification.findUnique({
            where: { userId },
        });
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const kycVerification = await tx.kycVerification.update({
                where: { userId },
                data: {
                    status: client_1.KycStatus.FAILED,
                    requiresReview: true,
                    failureReason: dto.failureReason,
                    reviewedById: adminId,
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { kycStatus: client_1.KycStatus.FAILED },
            });
            await tx.adminActivityLog.create({
                data: {
                    adminId,
                    action: 'KYC_REJECT',
                    entityType: 'User',
                    entityId: userId,
                    metadata: {
                        failureReason: dto.failureReason,
                    },
                },
            });
            return kycVerification;
        });
        return updated;
    }
};
exports.KycService = KycService;
exports.KycService = KycService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KycService);
//# sourceMappingURL=kyc.service.js.map