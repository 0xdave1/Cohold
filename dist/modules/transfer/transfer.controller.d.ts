import { TransferService } from './transfer.service';
import { P2PTransferDto } from './dto/p2p-transfer.dto';
export declare class TransferController {
    private readonly transferService;
    constructor(transferService: TransferService);
    p2p(user: {
        id: string;
    }, dto: P2PTransferDto): Promise<{
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
