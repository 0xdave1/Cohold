import { AdminService } from './admin.service';
import { Currency } from '@prisma/client';
declare class DistributionBatchDto {
    propertyId: string;
    totalAmount: string;
    currency: Currency;
}
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    overview(): Promise<{
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
    listUsers(page?: string, limit?: string, kycStatus?: string): Promise<{
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
    distributionBatch(admin: {
        id: string;
    }, dto: DistributionBatchDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: import(".prisma/client").$Enums.Currency;
        status: import(".prisma/client").$Enums.DistributionStatus;
        propertyId: string;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        executedById: string;
    }>;
    complianceReport(): Promise<{
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
    activityLog(page?: string, limit?: string): Promise<{
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
export {};
