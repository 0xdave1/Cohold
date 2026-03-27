import { PropertyService } from './property.service';
import { CreatePropertyDto } from './dto/create-property.dto';
export declare class PropertyController {
    private readonly propertyService;
    constructor(propertyService: PropertyService);
    create(admin: {
        id: string;
    }, dto: CreatePropertyDto): Promise<{
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
    }>;
    submitReview(admin: {
        id: string;
    }, id: string): Promise<{
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
    }>;
    approve(admin: {
        id: string;
    }, id: string): Promise<{
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
    }>;
    publish(admin: {
        id: string;
    }, id: string): Promise<{
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
    }>;
    details(id: string): Promise<{
        fundingProgressPercent: string;
        investments: {
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
        documents: {
            type: string;
            id: string;
            createdAt: Date;
            propertyId: string;
            s3Key: string;
        }[];
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
    }>;
}
