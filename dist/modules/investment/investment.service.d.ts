import { PrismaService } from '../../prisma/prisma.service';
import { CreateFractionalInvestmentDto } from './dto/create-fractional-investment.dto';
export declare class InvestmentService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createFractional(userId: string, dto: CreateFractionalInvestmentDto): Promise<{
        investmentId: string;
        propertyId: string;
        amount: string;
        currency: import(".prisma/client").$Enums.Currency;
        shares: string;
        walletBalanceAfter: string;
    }>;
    getInvestment(id: string): Promise<{
        property: {
            description: string;
            location: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: import(".prisma/client").$Enums.Currency;
            status: import(".prisma/client").$Enums.PropertyStatus;
            title: string;
            totalValue: import("@prisma/client/runtime/library").Decimal;
            minInvestment: import("@prisma/client/runtime/library").Decimal;
            currentRaised: import("@prisma/client/runtime/library").Decimal;
            sharesTotal: import("@prisma/client/runtime/library").Decimal;
            sharesSold: import("@prisma/client/runtime/library").Decimal;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        currency: import(".prisma/client").$Enums.Currency;
        status: import(".prisma/client").$Enums.InvestmentStatus;
        amount: import("@prisma/client/runtime/library").Decimal;
        propertyId: string;
        shares: import("@prisma/client/runtime/library").Decimal;
    }>;
    getInvestmentsByUser(userId: string, page?: number, limit?: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            currency: import(".prisma/client").$Enums.Currency;
            status: import(".prisma/client").$Enums.InvestmentStatus;
            amount: import("@prisma/client/runtime/library").Decimal;
            propertyId: string;
            shares: import("@prisma/client/runtime/library").Decimal;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
}
