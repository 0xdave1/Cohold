import {
  BadRequestException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VirtualAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a dedicated virtual account for a verified user.
   * Only call after KYC is VERIFIED and onboarding is complete.
   */
  async createVirtualAccountForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    throw new BadRequestException(
      'Virtual account funding is temporarily unavailable. Use Flutterwave wallet funding.',
    );
  }

  async getVirtualAccountsForUser(userId: string) {
    const accounts = await this.prisma.virtualAccount.findMany({
      where: { userId },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        bankName: true,
        currency: true,
      },
    });
    return accounts;
  }
}
