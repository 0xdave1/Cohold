import { InvestmentService } from './investment.service';
import { CreateFractionalInvestmentDto } from './dto/create-fractional-investment.dto';
export declare class InvestmentController {
    private readonly investmentService;
    constructor(investmentService: InvestmentService);
    createFractional(user: {
        id: string;
    }, dto: CreateFractionalInvestmentDto): Promise<{
        investmentId: string;
        propertyId: string;
        amount: string;
        currency: import(".prisma/client").$Enums.Currency;
        shares: string;
        walletBalanceAfter: string;
    }>;
    getById(id: string): Promise<{
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
    getByUser(userId: string, page?: string, limit?: string): Promise<{
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
