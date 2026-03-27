import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
export declare class PaymentService {
    private readonly prisma;
    private readonly walletService;
    private readonly logger;
    constructor(prisma: PrismaService, walletService: WalletService);
    handlePaystackEvent(payload: any): Promise<void>;
    private handleChargeSuccess;
}
