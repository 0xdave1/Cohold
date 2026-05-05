import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Central KYC gating for regulated / money movement flows (Issue 5).
 */
@Injectable()
export class KycPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertFromUserSnapshot(user: { isFrozen: boolean; kycStatus: KycStatus }): void {
    if (user.isFrozen) {
      throw new ForbiddenException({ code: 'ACCOUNT_FROZEN', message: 'Account is disabled' });
    }
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException({ code: 'KYC_REQUIRED', message: 'Verified KYC is required' });
    }
  }

  async assertUserKycVerifiedForMoneyMovement(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isFrozen: true, kycStatus: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.assertFromUserSnapshot(user);
  }
}
