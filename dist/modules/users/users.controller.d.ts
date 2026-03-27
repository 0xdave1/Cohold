import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(user: {
        id: string;
    }): Promise<{
        id: string;
        email: string;
        phoneNumber: string | null;
        username: string | null;
        kycStatus: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
    }>;
}
