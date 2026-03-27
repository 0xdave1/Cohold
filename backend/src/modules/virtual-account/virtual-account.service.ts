import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackService } from '../paystack/paystack.service';
import { Currency } from '@prisma/client';

@Injectable()
export class VirtualAccountService {
  private readonly logger = new Logger(VirtualAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackService: PaystackService,
  ) {}

  /**
   * Create a dedicated virtual account for a verified user.
   * Only call after KYC is VERIFIED and onboarding is complete.
   */
  async createVirtualAccountForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        kycStatus: true,
        onboardingCompletedAt: true,
        paystackCustomerCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== 'VERIFIED' || !user.onboardingCompletedAt) {
      throw new BadRequestException(
        'User must be KYC verified with completed onboarding before creating virtual account',
      );
    }

    const existing = await this.prisma.virtualAccount.findFirst({
      where: { userId, currency: Currency.NGN },
    });
    if (existing) {
      return {
        id: existing.id,
        accountNumber: existing.accountNumber,
        accountName: existing.accountName,
        bankName: existing.bankName,
        currency: existing.currency,
      };
    }

    let customerCode = user.paystackCustomerCode;
    if (!customerCode) {
      customerCode = await this.paystackService.createCustomer({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber,
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { paystackCustomerCode: customerCode },
      });
    }

    const vaData = await this.paystackService.createDedicatedAccount(customerCode);

    const virtualAccount = await this.prisma.virtualAccount.create({
      data: {
        userId,
        provider: 'PAYSTACK',
        accountNumber: vaData.accountNumber,
        accountName: vaData.accountName,
        bankName: vaData.bankName,
        currency: Currency.NGN,
      },
    });

    this.logger.log(`Created virtual account for user ${userId}: ${vaData.accountNumber}`);

    return {
      id: virtualAccount.id,
      accountNumber: virtualAccount.accountNumber,
      accountName: virtualAccount.accountName,
      bankName: virtualAccount.bankName,
      currency: virtualAccount.currency,
    };
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
