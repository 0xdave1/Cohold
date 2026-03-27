import { KycService } from './kyc.service';
import { SubmitBvnDto } from './dto/submit-bvn.dto';
import { KycReviewDto } from './dto/kyc-review.dto';
export declare class KycController {
    private readonly kycService;
    constructor(kycService: KycService);
    submitBvn(user: {
        id: string;
    }, dto: SubmitBvnDto): Promise<{
        status: "PENDING";
    }>;
    approve(admin: {
        id: string;
    }, userId: string, dto: KycReviewDto): Promise<{
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
    reject(admin: {
        id: string;
    }, userId: string, dto: KycReviewDto): Promise<{
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
