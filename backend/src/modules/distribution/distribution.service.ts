import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_USER_ID, WalletService } from '../wallet/wallet.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { toDecimal, formatMoney } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DistributionBatchItemStatus,
  DistributionBatchStatus,
  InvestmentStatus,
  LedgerOperationType,
  PropertyIncomeEventStatus,
  Prisma,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { CreateIncomeEventDto } from './dto/create-income-event.dto';
import { CreateDistributionBatchDto } from './dto/create-distribution-batch.dto';
import { ProcessDistributionBatchDto } from './dto/process-distribution-batch.dto';

const ITEM_BATCH_SIZE = 200;

@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toPeriod(value?: string | Date | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private distributeByShares(
    netDistributable: Decimal,
    rows: Array<{ investmentId: string; userId: string; shares: Decimal; ownershipPercent: Decimal }>,
  ) {
    const totalShares = rows.reduce((acc, r) => acc.plus(r.shares), new Decimal(0));
    if (totalShares.lte(0)) return [];
    const withFractions = rows.map((r) => {
      const raw = netDistributable.mul(r.shares).div(totalShares);
      const rounded = raw.toDecimalPlaces(4, Decimal.ROUND_DOWN);
      return { ...r, amount: rounded, fractional: raw.minus(rounded) };
    });
    const distributed = withFractions.reduce((a, r) => a.plus(r.amount), new Decimal(0));
    let remainder = netDistributable.minus(distributed).toDecimalPlaces(4, Decimal.ROUND_DOWN);
    if (remainder.gt(0)) {
      const sorted = [...withFractions].sort((a, b) => {
        const c = b.fractional.comparedTo(a.fractional);
        if (c !== 0) return c;
        return a.investmentId.localeCompare(b.investmentId);
      });
      let i = 0;
      const oneUnit = new Decimal('0.0001');
      while (remainder.gte(oneUnit) && sorted.length > 0) {
        sorted[i % sorted.length].amount = sorted[i % sorted.length].amount.plus(oneUnit);
        remainder = remainder.minus(oneUnit);
        i++;
      }
    }
    return withFractions.map((r) => ({
      investmentId: r.investmentId,
      userId: r.userId,
      shares: r.shares,
      ownershipPercent: r.ownershipPercent,
      amount: r.amount,
    })).filter((r) => r.amount.gt(0));
  }

  async createIncomeEvent(adminId: string, dto: CreateIncomeEventDto) {
    const property = await this.prisma.property.findFirst({ where: { id: dto.propertyId, deletedAt: null } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.currency !== dto.currency) throw new BadRequestException('Currency mismatch with property');
    const amount = fixMoney(toDecimal(dto.amount));
    if (amount.lte(0)) throw new BadRequestException('Income amount must be positive');

    const created = await this.prisma.propertyIncomeEvent.create({
      data: {
        propertyId: dto.propertyId,
        amount: moneyStr(amount),
        currency: dto.currency,
        type: dto.type,
        periodStart: this.toPeriod(dto.periodStart),
        periodEnd: this.toPeriod(dto.periodEnd),
        receivedAt: new Date(dto.receivedAt),
        sourceReference: dto.sourceReference ?? null,
        createdByAdminId: adminId,
        status: PropertyIncomeEventStatus.PENDING,
      },
    });
    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'CREATE_PROPERTY_INCOME_EVENT',
        entityType: 'PropertyIncomeEvent',
        entityId: created.id,
        metadata: {
          propertyId: created.propertyId,
          amount: String(created.amount ?? ''),
          currency: created.currency,
          type: created.type,
        } as Prisma.InputJsonValue,
      },
    });
    return created;
  }

  async approveIncomeEvent(adminId: string, incomeEventId: string) {
    const event = await this.prisma.propertyIncomeEvent.findUnique({ where: { id: incomeEventId } });
    if (!event) throw new NotFoundException('Income event not found');
    if (event.status !== PropertyIncomeEventStatus.PENDING) {
      throw new BadRequestException(`Income event cannot be approved from status ${event.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const incomeWallet = await this.walletService.getPropertyIncomeWallet(tx, event.propertyId, event.currency);
      const platformWallet = await this.walletService.getPlatformWallet(tx, event.currency);
      const ref = `INCOME_EVENT:${event.id}`;
      await this.walletService.postDoubleEntry(
        tx,
        ref,
        [
          {
            walletId: platformWallet.id,
            userId: PLATFORM_USER_ID,
            type: TransactionType.DISTRIBUTION,
            direction: TransactionDirection.DEBIT,
            amount: toDecimal(event.amount.toString()),
            currency: event.currency,
            metadata: { incomeEventId: event.id, propertyId: event.propertyId, role: 'FUND_INCOME_POOL' } as Prisma.InputJsonValue,
          },
          {
            walletId: incomeWallet.id,
            userId: incomeWallet.userId,
            type: TransactionType.DISTRIBUTION,
            direction: TransactionDirection.CREDIT,
            amount: toDecimal(event.amount.toString()),
            currency: event.currency,
            metadata: { incomeEventId: event.id, propertyId: event.propertyId, role: 'PROPERTY_INCOME_CREDIT' } as Prisma.InputJsonValue,
          },
        ],
        {
          operationType: LedgerOperationType.PROPERTY_RENT_DISTRIBUTION,
          sourceModule: 'distribution.approveIncomeEvent',
          sourceId: event.id,
        },
      );

      await tx.propertyIncomeEvent.update({
        where: { id: event.id },
        data: {
          status: PropertyIncomeEventStatus.POSTED,
          approvedByAdminId: adminId,
          ledgerOperationId: ref,
        },
      });
      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'APPROVE_PROPERTY_INCOME_EVENT',
          entityType: 'PropertyIncomeEvent',
          entityId: event.id,
          metadata: {
            propertyId: event.propertyId,
            amount: event.amount.toString(),
            currency: event.currency,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return this.prisma.propertyIncomeEvent.findUniqueOrThrow({ where: { id: incomeEventId } });
  }

  async rejectIncomeEvent(adminId: string, incomeEventId: string, reason?: string) {
    const event = await this.prisma.propertyIncomeEvent.findUnique({ where: { id: incomeEventId } });
    if (!event) throw new NotFoundException('Income event not found');
    if (event.status !== PropertyIncomeEventStatus.PENDING) {
      throw new BadRequestException(`Income event cannot be rejected from status ${event.status}`);
    }
    const updated = await this.prisma.propertyIncomeEvent.update({
      where: { id: incomeEventId },
      data: {
        status: PropertyIncomeEventStatus.REJECTED,
        approvedByAdminId: adminId,
        metadata: {
          ...(event.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
          rejectionReason: reason ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'REJECT_PROPERTY_INCOME_EVENT',
        entityType: 'PropertyIncomeEvent',
        entityId: incomeEventId,
        metadata: {
          reason: reason ?? null,
          propertyId: event.propertyId,
        } as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  async createDistributionBatch(adminId: string, dto: CreateDistributionBatchDto) {
    const incomeEvent = await this.prisma.propertyIncomeEvent.findUnique({ where: { id: dto.incomeEventId } });
    if (!incomeEvent) throw new NotFoundException('Income event not found');
    if (incomeEvent.status !== PropertyIncomeEventStatus.POSTED) {
      throw new BadRequestException('Distribution cannot run without approved income event');
    }

    const grossIncome = fixMoney(toDecimal(incomeEvent.amount.toString()));
    const expenses = fixMoney(toDecimal(dto.expenses ?? '0'));
    const platformFee = fixMoney(toDecimal(dto.platformFee ?? '0'));
    const netDistributable = fixMoney(grossIncome.minus(expenses).minus(platformFee));
    if (netDistributable.lte(0)) throw new BadRequestException('Net distributable must be positive');

    const reference = dto.reference?.trim() || `DIST_BATCH:${incomeEvent.id}`;
    const existing = await this.prisma.distributionBatch.findUnique({ where: { reference } });
    const fingerprint = `${incomeEvent.id}|${moneyStr(grossIncome)}|${moneyStr(expenses)}|${moneyStr(platformFee)}|${incomeEvent.currency}`;
    if (existing) {
      const existingFingerprint =
        (existing.metadata as Record<string, unknown> | null)?.fingerprint;
      if (existingFingerprint === fingerprint) {
        return existing;
      }
      throw new ConflictException('Conflicting distribution batch reference');
    }

    const investments = await this.prisma.investment.findMany({
      where: {
        propertyId: incomeEvent.propertyId,
        status: InvestmentStatus.ACTIVE,
        shares: { gt: 0 as any },
      },
      select: { id: true, userId: true, shares: true, ownershipPercent: true },
      orderBy: { id: 'asc' },
    });
    const rows = investments.map((i) => ({
      investmentId: i.id,
      userId: i.userId,
      shares: toDecimal(i.shares.toString()),
      ownershipPercent: toDecimal(i.ownershipPercent.toString()),
    }));
    const computed = this.distributeByShares(netDistributable, rows);
    const sumComputed = computed.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
    if (sumComputed.gt(netDistributable)) {
      throw new BadRequestException('Rounding exceeded net distributable');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.distributionBatch.create({
        data: {
          propertyId: incomeEvent.propertyId,
          incomeEventId: incomeEvent.id,
          periodStart: incomeEvent.periodStart ?? null,
          periodEnd: incomeEvent.periodEnd ?? null,
          currency: incomeEvent.currency,
          grossIncome: moneyStr(grossIncome),
          expenses: moneyStr(expenses),
          platformFee: moneyStr(platformFee),
          netDistributable: moneyStr(netDistributable),
          status: DistributionBatchStatus.DRAFT,
          reference,
          createdByAdminId: adminId,
          metadata: {
            fingerprint,
            undistributedRemainder: moneyStr(netDistributable.minus(sumComputed)),
            recordDate: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      if (computed.length > 0) {
        await tx.distributionBatchItem.createMany({
          data: computed.map((i) => ({
            batchId: batch.id,
            userId: i.userId,
            investmentId: i.investmentId,
            shares: i.shares.toFixed(8),
            ownershipPercent: i.ownershipPercent.toFixed(6),
            amount: moneyStr(i.amount),
            currency: incomeEvent.currency,
            status: DistributionBatchItemStatus.PENDING,
          })),
        });
      }
      await tx.adminActivityLog.create({
        data: {
          adminId,
          action: 'CREATE_DISTRIBUTION_BATCH',
          entityType: 'DistributionBatch',
          entityId: batch.id,
          metadata: {
            reference,
            propertyId: batch.propertyId,
            incomeEventId: batch.incomeEventId,
            netDistributable: batch.netDistributable.toString(),
          } as Prisma.InputJsonValue,
        },
      });
      return batch;
    });
  }

  async previewDistributionBatch(batchId: string) {
    const batch = await this.prisma.distributionBatch.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: { amount: 'desc' } } },
    });
    if (!batch) throw new NotFoundException('Distribution batch not found');
    const totalItems = batch.items.reduce((a, i) => a.plus(toDecimal(i.amount.toString())), new Decimal(0));
    return {
      batch,
      totals: {
        netDistributable: formatMoney(toDecimal(batch.netDistributable.toString())),
        totalItems: formatMoney(totalItems),
        remainder: formatMoney(toDecimal(batch.netDistributable.toString()).minus(totalItems)),
      },
    };
  }

  async approveDistributionBatch(adminId: string, batchId: string) {
    const batch = await this.prisma.distributionBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Distribution batch not found');
    if (batch.status !== DistributionBatchStatus.DRAFT) {
      throw new BadRequestException(`Batch cannot be approved from ${batch.status}`);
    }
    const updated = await this.prisma.distributionBatch.update({
      where: { id: batchId },
      data: { status: DistributionBatchStatus.APPROVED, approvedByAdminId: adminId },
    });
    await this.prisma.adminActivityLog.create({
      data: {
        adminId,
        action: 'APPROVE_DISTRIBUTION_BATCH',
        entityType: 'DistributionBatch',
        entityId: batchId,
      },
    });
    return updated;
  }

  async processDistributionBatch(batchId: string, dto?: ProcessDistributionBatchDto, adminId?: string) {
    const batch = await this.prisma.distributionBatch.findUnique({
      where: { id: batchId },
      include: { incomeEvent: true },
    });
    if (!batch) throw new NotFoundException('Distribution batch not found');
    if (!batch.incomeEvent || batch.incomeEvent.status !== PropertyIncomeEventStatus.POSTED) {
      throw new BadRequestException('Distribution cannot run without approved income event');
    }
    if (
      batch.status !== DistributionBatchStatus.APPROVED &&
      batch.status !== DistributionBatchStatus.PROCESSING &&
      batch.status !== DistributionBatchStatus.PARTIALLY_FAILED
    ) {
      throw new BadRequestException(`Batch cannot be processed from status ${batch.status}`);
    }

    await this.prisma.distributionBatch.update({
      where: { id: batchId },
      data: { status: DistributionBatchStatus.PROCESSING },
    });

    const items = await this.prisma.distributionBatchItem.findMany({
      where: { batchId, status: { in: [DistributionBatchItemStatus.PENDING, DistributionBatchItemStatus.FAILED] } },
      orderBy: { id: 'asc' },
      take: ITEM_BATCH_SIZE,
    });

    const incomeWallet = await this.prisma.$transaction((tx) =>
      this.walletService.getPropertyIncomeWallet(tx, batch.propertyId, batch.currency),
    );
    const incomeBal = toDecimal(
      (await this.prisma.wallet.findUniqueOrThrow({ where: { id: incomeWallet.id } })).balance.toString(),
    );
    const pendingTotal = items.reduce((a, i) => a.plus(toDecimal(i.amount.toString())), new Decimal(0));
    if (incomeBal.lt(pendingTotal)) {
      await this.prisma.distributionBatch.update({
        where: { id: batch.id },
        data: { status: DistributionBatchStatus.FAILED },
      });
      throw new BadRequestException('Insufficient property income wallet balance');
    }

    let posted = 0;
    let failed = 0;
    for (const item of items) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const userWallet = await tx.wallet.findUnique({
            where: { userId_currency: { userId: item.userId, currency: batch.currency } },
          });
          if (!userWallet) {
            throw new BadRequestException('User wallet not found');
          }
          const ref = dto?.reference?.trim()
            ? `${dto.reference}:${item.id}`
            : `DISTRIBUTION:${batch.id}:${item.id}`;
          const postedLeg = await this.walletService.postDoubleEntry(
            tx,
            ref,
            [
              {
                walletId: incomeWallet.id,
                userId: incomeWallet.userId,
                type: TransactionType.DISTRIBUTION,
                direction: TransactionDirection.DEBIT,
                amount: toDecimal(item.amount.toString()),
                currency: batch.currency,
                investmentId: item.investmentId ?? undefined,
                propertyId: batch.propertyId,
                metadata: { batchId: batch.id, itemId: item.id, role: 'PROPERTY_INCOME_DEBIT' } as Prisma.InputJsonValue,
              },
              {
                walletId: userWallet.id,
                userId: item.userId,
                type: TransactionType.DISTRIBUTION,
                direction: TransactionDirection.CREDIT,
                amount: toDecimal(item.amount.toString()),
                currency: batch.currency,
                investmentId: item.investmentId ?? undefined,
                propertyId: batch.propertyId,
                metadata: { batchId: batch.id, itemId: item.id, role: 'INVESTOR_DISTRIBUTION_CREDIT' } as Prisma.InputJsonValue,
              },
            ],
            {
              operationType: LedgerOperationType.PROPERTY_RENT_DISTRIBUTION,
              sourceModule: 'distribution.processDistributionBatch',
              sourceId: item.id,
            },
          );
          await tx.distributionBatchItem.update({
            where: { id: item.id },
            data: {
              status: DistributionBatchItemStatus.POSTED,
              ledgerOperationId: postedLeg.legs[0]?.ledgerOperationId ?? null,
              failureReason: null,
            },
          });
        });
        posted++;
        try {
          await this.notificationsService.notifyRoiCredited(
            item.userId,
            `Property ${batch.propertyId}`,
            moneyStr(toDecimal(item.amount.toString())),
            batch.currency,
            `${batch.periodStart?.toISOString().slice(0, 10) ?? 'period-start'} to ${batch.periodEnd?.toISOString().slice(0, 10) ?? 'period-end'}`,
          );
        } catch (e) {
          this.logger.warn(`Distribution item notification failed item=${item.id}: ${e}`);
        }
      } catch (err) {
        failed++;
        await this.prisma.distributionBatchItem.update({
          where: { id: item.id },
          data: {
            status: DistributionBatchItemStatus.FAILED,
            failureReason: err instanceof Error ? err.message : 'Failed to process item',
          },
        });
      }
    }

    const remaining = await this.prisma.distributionBatchItem.count({
      where: { batchId, status: DistributionBatchItemStatus.PENDING },
    });
    const failedCount = await this.prisma.distributionBatchItem.count({
      where: { batchId, status: DistributionBatchItemStatus.FAILED },
    });
    const nextStatus =
      remaining === 0 && failedCount === 0
        ? DistributionBatchStatus.COMPLETED
        : remaining === 0
          ? DistributionBatchStatus.PARTIALLY_FAILED
          : DistributionBatchStatus.PROCESSING;

    const updated = await this.prisma.distributionBatch.update({
      where: { id: batchId },
      data: {
        status: nextStatus,
        processedAt:
          nextStatus === DistributionBatchStatus.COMPLETED ||
          nextStatus === DistributionBatchStatus.PARTIALLY_FAILED
            ? new Date()
            : null,
      },
    });
    await this.prisma.adminActivityLog.create({
      data: {
        adminId: adminId ?? batch.createdByAdminId,
        action: 'PROCESS_DISTRIBUTION_BATCH',
        entityType: 'DistributionBatch',
        entityId: batchId,
        metadata: {
          posted,
          failed,
          status: nextStatus,
        } as Prisma.InputJsonValue,
      },
    });
    return { batch: updated, posted, failed };
  }

  async listDistributionBatches(propertyId?: string, status?: DistributionBatchStatus) {
    return this.prisma.distributionBatch.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true, incomeEvent: true },
    });
  }

  async getDistributionBatch(batchId: string) {
    const batch = await this.prisma.distributionBatch.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: { createdAt: 'asc' } }, incomeEvent: true, property: true },
    });
    if (!batch) throw new NotFoundException('Distribution batch not found');
    return batch;
  }

  async listFailedDistributionItems(batchId: string) {
    return this.prisma.distributionBatchItem.findMany({
      where: { batchId, status: DistributionBatchItemStatus.FAILED },
      orderBy: { createdAt: 'asc' },
    });
  }

  async retryFailedDistributionItems(batchId: string, adminId?: string) {
    await this.prisma.distributionBatchItem.updateMany({
      where: { batchId, status: DistributionBatchItemStatus.FAILED },
      data: { status: DistributionBatchItemStatus.PENDING, failureReason: null },
    });
    const result = await this.processDistributionBatch(batchId, undefined, adminId);
    await this.prisma.adminActivityLog.create({
      data: {
        adminId: adminId ?? result.batch.createdByAdminId,
        action: 'RETRY_FAILED_DISTRIBUTION_ITEMS',
        entityType: 'DistributionBatch',
        entityId: batchId,
      },
    });
    return result;
  }

  async listIncomeEvents(propertyId?: string, status?: PropertyIncomeEventStatus) {
    return this.prisma.propertyIncomeEvent.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUserDistributionHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.distributionBatchItem.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          batch: {
            select: {
              id: true,
              propertyId: true,
              periodStart: true,
              periodEnd: true,
              status: true,
            },
          },
          investment: {
            select: { id: true },
          },
        },
      }),
      this.prisma.distributionBatchItem.count({ where: { userId } }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  // Compatibility wrappers (legacy Issue 8 kickoff routes)
  async createDistribution(adminId: string, dto: CreateDistributionDto) {
    void adminId;
    void dto;
    throw new BadRequestException(
      'Legacy direct distribution is disabled. Create and approve an income event, then create a distribution batch.',
    );
  }

  /**
   * Scheduled rental yield — delegates to `InvestmentService.distributeROI` (InvestmentReturn + grouped ROI txs).
   */
  async distributeMonthlyRentalYield(propertyId: string, adminId: string) {
    void propertyId;
    void adminId;
    throw new BadRequestException(
      'Projected annualYield distribution is disabled. Use realized income events and distribution batches.',
    );
  }

  async getDistribution(id: string) {
    return this.getDistributionBatch(id);
  }

  async listDistributions(propertyId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.distributionBatch.findMany({
        where: propertyId ? { propertyId } : {},
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, property: { select: { id: true, title: true } } },
      }),
      this.prisma.distributionBatch.count({ where: propertyId ? { propertyId } : {} }),
    ]);
    return { items, meta: { page, limit, total } };
  }
}
