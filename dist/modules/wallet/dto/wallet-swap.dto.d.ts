import { Currency } from '@prisma/client';
export declare class WalletSwapDto {
    fromCurrency: Currency;
    toCurrency: Currency;
    amount: string;
    clientReference?: string;
}
