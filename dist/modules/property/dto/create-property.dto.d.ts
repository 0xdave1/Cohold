import { Currency } from '@prisma/client';
export declare class CreatePropertyDto {
    title: string;
    description: string;
    location: string;
    currency: Currency;
    totalValue: string;
    sharesTotal: string;
    minInvestment: string;
    type?: string;
}
