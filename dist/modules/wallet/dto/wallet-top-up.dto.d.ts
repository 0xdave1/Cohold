import { Currency } from '@prisma/client';
export declare class WalletTopUpDto {
    currency: Currency;
    amount: string;
    clientReference?: string;
    reason?: string;
}
