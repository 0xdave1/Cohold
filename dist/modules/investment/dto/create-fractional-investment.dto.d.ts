import { Currency } from '@prisma/client';
export declare class CreateFractionalInvestmentDto {
    propertyId: string;
    amount: string;
    currency: Currency;
    clientReference: string;
}
