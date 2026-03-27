import { PrismaService } from '../../prisma/prisma.service';
import { WalletTopUpDto } from './dto/wallet-top-up.dto';
import { WalletSwapDto } from './dto/wallet-swap.dto';
export declare class WalletService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getBalances(userId: string): Promise<{
        id: string;
        currency: import(".prisma/client").$Enums.Currency;
        balance: string;
    }[]>;
    topUp(userId: string, dto: WalletTopUpDto): Promise<{
        walletId: string;
        currency: import(".prisma/client").$Enums.Currency;
        balance: string;
        transactionReference: string;
    }>;
    swap(userId: string, dto: WalletSwapDto): Promise<{
        fromCurrency: import(".prisma/client").$Enums.Currency;
        toCurrency: import(".prisma/client").$Enums.Currency;
        amount: string;
        receivedAmount: string;
        fee: string;
        before: {
            fromBalance: string;
            toBalance: string;
        };
        after: {
            fromBalance: string;
            toBalance: string;
        };
    }>;
}
