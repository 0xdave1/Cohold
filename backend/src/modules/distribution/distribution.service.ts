import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_USER_ID, WalletService } from '../wallet/wallet.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import { InvestmentService } from '../investment/investment.service';
import {
  DistributionStatus,
  InvestmentStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';

const BATCH_SIZE = 200;
const RENT_DISTRIBUTION_FEE_RATE = 0.03; // 3% — admin lump-sum distributions (existing)

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly investmentService: InvestmentService,
  ) {}

  async createDistribution(adminId: string, dto: CreateDistributionDto) {
    const totalAmount = toDecimal(dto.totalAmount);
    if (totalAmount.lte(0)) {
      throw new BadRequestException('Total amount must be positive');
    }

    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.currency !== dto.currency) {
      throw new BadRequestException('Currency mismatch with property');
    }

    const sharesTotalDec = toDecimal(property.sharesTotal.toString());
    if (sharesTotalDec.lte(0)) {
      throw new BadRequestException('Property has no shares configured');
    }

    const platformFee = fixMoney(totalAmount.mul(RENT_DISTRIBUTION_FEE_RATE));
    const distributableAmount = fixMoney(totalAmount.minus(platformFee));

    const distribution = await this.prisma.distribution.create({
      data: {
        propertyId: dto.propertyId,
        totalAmount: moneyStr(totalAmount),
        platformFee: moneyStr(platformFee),
        currency: dto.currency,
        status: DistributionStatus.PENDING,
        executedById: adminId,
      },
    });

    let investorsPaid = 0;
    let distributedTotal = new Decimal(0);
    let cursor: string | undefined;
    const distGroupId = `DIST-${distribution.id}`;

    do {
      const batch = await this.prisma.investment.findMany({
        where: {
          propertyId: dto.propertyId,
          status: InvestmentStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
          shares: true,
          currency: true,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (batch.length === 0) {
        break;
      }

      await this.prisma.$transaction(async (tx) => {
        for (const investment of batch) {
          const investmentShares = toDecimal(investment.shares.toString());
          const payout = fixMoney(
            investmentShares.div(sharesTotalDec).mul(distributableAmount),
          );

          if (payout.lte(0)) {
            continue;
          }

          const wallet = await tx.wallet.findUnique({
            where: {
              userId_currency: {
                userId: investment.userId,
                currency: dto.currency,
              },
            },
          });

          if (!wallet) {
            this.logger.warn(
              `No ${dto.currency} wallet for user ${investment.userId}, skipping payout for investment ${investment.id}`,
            );
            continue;
          }

          const currentBalance = toDecimal(wallet.balance.toString());
          const newBalance = fixMoney(currentBalance.plus(payout));

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: moneyStr(newBalance) },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              userId: investment.userId,
              reference: `DIST-${distribution.id}-${randomUUID()}`,
              groupId: distGroupId,
              type: TransactionType.DISTRIBUTION,
              status: TransactionStatus.COMPLETED,
              amount: moneyStr(payout),
              currency: dto.currency,
              direction: TransactionDirection.CREDIT,
              metadata: {
                propertyId: dto.propertyId,
                distributionId: distribution.id,
                investmentId: investment.id,
                groupId: distGroupId,
              },
            },
          });

          await tx.distributionPayout.create({
            data: {
              distributionId: distribution.id,
              investmentId: investment.id,
              amount: moneyStr(payout),
              currency: dto.currency,
            },
          });

          distributedTotal = distributedTotal.plus(payout);
          investorsPaid++;
        }
      });

      cursor = batch[batch.length - 1]?.id;
      this.logger.log(
        `Distribution ${distribution.id}: processed batch, cursor ${cursor ?? 'done'}, investorsPaid=${investorsPaid}`,
      );
    } while (cursor);

    const remainder = fixMoney(distributableAmount.minus(distributedTotal));
    const finalPlatformFee = platformFee.plus(remainder);

    if (finalPlatformFee.gt(0)) {
      await this.prisma.$transaction(async (tx) => {
        const platformWallet = await this.walletService.getPlatformWallet(tx, dto.currency);
        const currentPlatformBalance = toDecimal(platformWallet.balance.toString());
        const newPlatformBalance = fixMoney(currentPlatformBalance.plus(finalPlatformFee));

        await tx.wallet.update({
          where: { id: platformWallet.id },
          data: { balance: moneyStr(newPlatformBalance) },
        });

        await tx.transaction.create({
          data: {
            walletId: platformWallet.id,
            userId: PLATFORM_USER_ID,
            reference: `DIST-FEE-${distribution.id}-${randomUUID()}`,
            groupId: `DIST-${distribution.id}`,
            type: TransactionType.FEE,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(finalPlatformFee),
            currency: dto.currency,
            direction: TransactionDirection.CREDIT,
            metadata: {
              propertyId: dto.propertyId,
              distributionId: distribution.id,
              feeType: 'RENT_DISTRIBUTION_FEE',
              baseFee: moneyStr(platformFee),
              remainder: moneyStr(remainder),
              groupId: `DIST-${distribution.id}`,
            },
          },
        });
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.distribution.update({
        where: { id: distribution.id },
        data: { status: DistributionStatus.COMPLETED },
      });

      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'EXECUTE_DISTRIBUTION',
          entityType: 'PROPERTY',
          entityId: dto.propertyId,
          metadata: {
            distributionId: distribution.id,
            totalAmount: moneyStr(totalAmount),
            platformFee: moneyStr(finalPlatformFee),
            totalDistributed: moneyStr(distributedTotal),
            investorsPaid,
            currency: dto.currency,
          },
        },
      });
    });

    return {
      distributionId: distribution.id,
      propertyId: dto.propertyId,
      investorsPaid,
      totalAmountDistributed: formatMoney(distributedTotal),
      platformFee: formatMoney(finalPlatformFee),
      currency: dto.currency,
    };
  }

  /**
   * Scheduled rental yield — delegates to `InvestmentService.distributeROI` (InvestmentReturn + grouped ROI txs).
   */
  async distributeMonthlyRentalYield(propertyId: string, adminId: string) {
    return this.investmentService.distributeROI(propertyId, { adminId });
  }

  async getDistribution(id: string) {
    const distribution = await this.prisma.distribution.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, title: true } },
        payouts: {
          include: {
            investment: {
              select: { id: true, userId: true, shares: true },
            },
          },
        },
      },
    });
    if (!distribution) {
      throw new NotFoundException('Distribution not found');
    }
    return distribution;
  }

  async listDistributions(propertyId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = propertyId ? { propertyId } : {};
    const [items, total] = await Promise.all([
      this.prisma.distribution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: { select: { id: true, title: true } },
          executedBy: { select: { id: true, email: true } },
          _count: { select: { payouts: true } },
        },
      }),
      this.prisma.distribution.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }
}
