import { PrismaService } from '../../prisma/prisma.service';
import { Currency } from '@prisma/client';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboardOverview(): Promise<{
        totalAum: string;
        usersCount: number;
        activeInvestorsCount: number;
        properties: {
            id: string;
            status: import(".prisma/client").$Enums.PropertyStatus;
            title: string;
            totalValue: import("@prisma/client/runtime/library").Decimal;
            currentRaised: import("@prisma/client/runtime/library").Decimal;
        }[];
    }>;
    listUsers(params: {
        page: number;
        limit: number;
        kycStatus?: string;
    }): Promise<{
        items: {
            id: string;
            email: string;
            username: string | null;
            kycStatus: import(".prisma/client").$Enums.KycStatus;
            createdAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    createDistributionBatch(adminId: string, propertyId: string, totalAmountStr: string, currency: Currency): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: import(".prisma/client").$Enums.Currency;
        status: import(".prisma/client").$Enums.DistributionStatus;
        propertyId: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        executedById: string;
    }>;
    getComplianceReport(): Promise<{
        highValueTransfers: {
            type: import(".prisma/client").$Enums.TransactionType;
            id: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            currency: import(".prisma/client").$Enums.Currency;
            walletId: string | null;
            reference: string;
            externalReference: string | null;
            status: import(".prisma/client").$Enums.TransactionStatus;
            amount: import("@prisma/client/runtime/library").Decimal;
            direction: import(".prisma/client").$Enums.TransactionDirection;
        }[];
    }>;
    getActivityLog(page?: number, limit?: number): Promise<{
        items: {
            id: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            action: string;
            createdAt: Date;
            adminId: string;
            entityType: string;
            entityId: string | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
}
