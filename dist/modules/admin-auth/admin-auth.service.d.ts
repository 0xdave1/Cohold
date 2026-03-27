import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminLoginDto } from './dto/admin-login.dto';
export declare class AdminAuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly configService;
    constructor(prisma: PrismaService, jwtService: JwtService, configService: ConfigService);
    validateAdmin(email: string, password: string): Promise<{
        id: string;
        email: string;
        passwordHash: string;
        lastLoginAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        role: import(".prisma/client").$Enums.AdminRole;
    }>;
    login(dto: AdminLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}
