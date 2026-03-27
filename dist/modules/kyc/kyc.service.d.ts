import { PrismaService } from '../../prisma/prisma.service';
import { SubmitBvnDto } from './dto/submit-bvn.dto';
import { KycReviewDto } from './dto/kyc-review.dto';
export declare class KycService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    submitBvn(userId: string, dto: SubmitBvnDto): Promise<{
        status: "PENDING";
    }>;
    approveKyc(adminId: string, userId: string, _dto: KycReviewDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.KycStatus;
        governmentIdType: string | null;
        governmentIdNumber: string | null;
        documentKey: string | null;
        failureReason: string | null;
        requiresReview: boolean;
        reviewedById: string | null;
    }>;
    rejectKyc(adminId: string, userId: string, dto: KycReviewDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.KycStatus;
        governmentIdType: string | null;
        governmentIdNumber: string | null;
        documentKey: string | null;
        failureReason: string | null;
        requiresReview: boolean;
        reviewedById: string | null;
    }>;
}
