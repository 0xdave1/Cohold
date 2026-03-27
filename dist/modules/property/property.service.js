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
exports.PropertyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const decimal_util_1 = require("../../common/money/decimal.util");
let PropertyService = class PropertyService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createProperty(adminId, dto) {
        const totalValue = (0, decimal_util_1.toDecimal)(dto.totalValue);
        const sharesTotal = (0, decimal_util_1.toDecimal)(dto.sharesTotal);
        const minInvestment = (0, decimal_util_1.toDecimal)(dto.minInvestment);
        if (totalValue.lte(0) || sharesTotal.lte(0) || minInvestment.lte(0)) {
            throw new common_1.BadRequestException('Monetary fields must be positive');
        }
        const property = await this.prisma.property.create({
            data: {
                title: dto.title,
                description: dto.description,
                location: dto.location,
                currency: dto.currency,
                totalValue,
                sharesTotal,
                minInvestment,
                status: client_1.PropertyStatus.DRAFT,
            },
        });
        await this.prisma.adminActivityLog.create({
            data: {
                adminId,
                action: 'PROPERTY_CREATE',
                entityType: 'Property',
                entityId: property.id,
            },
        });
        return property;
    }
    async submitForReview(adminId, propertyId) {
        const property = await this.prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.status !== client_1.PropertyStatus.DRAFT) {
            throw new common_1.BadRequestException('Only DRAFT properties can be submitted for review');
        }
        const updated = await this.prisma.property.update({
            where: { id: propertyId },
            data: { status: client_1.PropertyStatus.UNDER_REVIEW },
        });
        await this.prisma.adminActivityLog.create({
            data: {
                adminId,
                action: 'PROPERTY_SUBMIT_REVIEW',
                entityType: 'Property',
                entityId: propertyId,
            },
        });
        return updated;
    }
    async approve(adminId, propertyId) {
        const property = await this.prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.status !== client_1.PropertyStatus.UNDER_REVIEW) {
            throw new common_1.BadRequestException('Only UNDER_REVIEW properties can be approved');
        }
        const updated = await this.prisma.property.update({
            where: { id: propertyId },
            data: { status: client_1.PropertyStatus.APPROVED },
        });
        await this.prisma.adminActivityLog.create({
            data: {
                adminId,
                action: 'PROPERTY_APPROVE',
                entityType: 'Property',
                entityId: propertyId,
            },
        });
        return updated;
    }
    async publish(adminId, propertyId) {
        const property = await this.prisma.property.findUnique({
            where: { id: propertyId },
        });
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        if (property.status !== client_1.PropertyStatus.APPROVED) {
            throw new common_1.BadRequestException('Only APPROVED properties can be published');
        }
        const updated = await this.prisma.property.update({
            where: { id: propertyId },
            data: { status: client_1.PropertyStatus.PUBLISHED },
        });
        await this.prisma.adminActivityLog.create({
            data: {
                adminId,
                action: 'PROPERTY_PUBLISH',
                entityType: 'Property',
                entityId: propertyId,
            },
        });
        return updated;
    }
    async getDetails(propertyId) {
        const property = await this.prisma.property.findUnique({
            where: { id: propertyId },
            include: {
                investments: true,
                documents: true,
            },
        });
        if (!property) {
            throw new common_1.NotFoundException('Property not found');
        }
        const totalShares = (0, decimal_util_1.toDecimal)(property.sharesTotal.toString());
        const soldShares = (0, decimal_util_1.toDecimal)(property.sharesSold.toString());
        const progress = totalShares.gt(0)
            ? soldShares.div(totalShares).mul(100)
            : (0, decimal_util_1.toDecimal)(0);
        return {
            ...property,
            fundingProgressPercent: (0, decimal_util_1.formatHighPrecision)(progress),
        };
    }
};
exports.PropertyService = PropertyService;
exports.PropertyService = PropertyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PropertyService);
//# sourceMappingURL=property.service.js.map