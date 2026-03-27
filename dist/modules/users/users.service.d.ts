import { PrismaService } from '../../prisma/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMe(userId: string): Promise<{
        id: string;
        email: string;
        phoneNumber: string | null;
        username: string | null;
        kycStatus: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
    }>;
}
