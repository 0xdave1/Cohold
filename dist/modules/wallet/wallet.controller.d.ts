import { WalletService } from './wallet.service';
import { WalletTopUpDto } from './dto/wallet-top-up.dto';
import { WalletSwapDto } from './dto/wallet-swap.dto';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalances(user: {
        id: string;
    }): Promise<{
        id: string;
        currency: import(".prisma/client").$Enums.Currency;
        balance: string;
    }[]>;
    topUp(user: {
        id: string;
    }, dto: WalletTopUpDto): Promise<{
        walletId: string;
        currency: import(".prisma/client").$Enums.Currency;
        balance: string;
        transactionReference: string;
    }>;
    swap(user: {
        id: string;
    }, dto: WalletSwapDto): Promise<{
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
