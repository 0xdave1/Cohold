import { PrismaService } from '../../prisma/prisma.service';
import { P2PTransferDto } from './dto/p2p-transfer.dto';
export declare class TransferService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    p2pTransfer(senderId: string, dto: P2PTransferDto): Promise<{
        fromUserId: string;
        toUserId: string;
        amount: string;
        currency: import(".prisma/client").$Enums.Currency;
        before: {
            senderBalance: string;
            recipientBalance: string;
        };
        after: {
            senderBalance: string;
            recipientBalance: string;
        };
    }>;
}
