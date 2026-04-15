import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_USER_ID, WalletService } from '../wallet/wallet.service';
import { PaystackService } from '../paystack/paystack.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFractionalInvestmentDto } from './dto/create-fractional-investment.dto';
import { toDecimal, formatMoney, formatHighPrecision } from '../../common/money/decimal.util';
import {
  fixMoney,
  fixOwnership,
  fixShare,
  moneyStr,
  shareStr,
} from '../../common/money/precision.constants';
import {
  InvestmentStatus,
  PropertyStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { SellFractionalInvestmentDto } from './dto/sell-fractional-investment.dto';

const INVESTMENT_FEE_RATE = 0.02; // 2% — fee on top of principal (buy)
const SELL_PROFIT_FEE_RATE = 0.1; // 10% of realised profit only (sell)
/** 3% platform cut on automated monthly ROI (matches distributeROI / InvestmentReturn fee). */
const MONTHLY_ROI_PLATFORM_FEE_RATE = 0.03;

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly paystackService: PaystackService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create fractional investment. Assumes user wallet is already funded (e.g. via Paystack).
   * Flow: User Wallet (debit) → Property Escrow (credit) + Platform Fee (credit).
   */
  async createFractional(userId: string, dto: CreateFractionalInvestmentDto) {
    const shares = toDecimal(dto.shares);
    if (shares.lte(0) || !shares.isInteger()) {
      throw new BadRequestException('Shares must be a positive integer');
    }

    const clientRef = dto.clientReference?.trim();

    // Idempotency: check by clientReference
    if (clientRef) {
      const existingInvestment = await this.prisma.investment.findFirst({
        where: { userId, propertyId: dto.propertyId, clientReference: clientRef },
      });
      if (existingInvestment) {
        const wallet = await this.prisma.wallet.findFirst({
          where: { userId, currency: existingInvestment.currency },
        });
        return this.formatInvestmentResponse(existingInvestment, wallet);
      }
      const existingTx = await this.prisma.transaction.findUnique({
        where: { reference: clientRef },
      });
      if (existingTx) {
        throw new ConflictException('Duplicate client reference');
      }
    }

    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.status !== PropertyStatus.PUBLISHED) {
      throw new BadRequestException('Property is not open for investment');
    }

    const currency = property.currency;
    const sharePrice = fixShare(toDecimal(property.sharePrice.toString()));
    /** Principal routed to escrow — money precision (DOWN) after share math. */
    const investmentAmount = fixMoney(sharePrice.mul(shares));
    const investmentFee = fixMoney(investmentAmount.mul(INVESTMENT_FEE_RATE));
    const totalCharge = fixMoney(investmentAmount.plus(investmentFee));

    const minInvestment = toDecimal(property.minInvestment.toString());
    if (investmentAmount.lt(minInvestment)) {
      throw new BadRequestException(
        `Minimum investment is ${formatMoney(minInvestment)} ${currency}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [lockedProperty] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Property" WHERE id = $1 FOR UPDATE`,
        dto.propertyId,
      );
      if (!lockedProperty) {
        throw new NotFoundException('Property not found');
      }

      const existingSharesSold = toDecimal(lockedProperty.sharesSold.toString());
      const sharesTotalDec = toDecimal(lockedProperty.sharesTotal.toString());
      const newSharesSold = existingSharesSold.plus(shares);
      if (newSharesSold.gt(sharesTotalDec)) {
        const remaining = sharesTotalDec.minus(existingSharesSold);
        throw new BadRequestException(
          `Not enough shares remaining. Available: ${formatHighPrecision(remaining)}`,
        );
      }

      const userWallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });
      if (!userWallet) {
        throw new NotFoundException('Wallet not found for investment currency');
      }

      const [lockedUserWallet] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Wallet" WHERE id = $1 FOR UPDATE`,
        userWallet.id,
      );
      if (!lockedUserWallet) {
        throw new NotFoundException('Wallet not found');
      }
      const userBalance = toDecimal(lockedUserWallet.balance.toString());
      if (userBalance.lt(totalCharge)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const platformWallet = await this.walletService.getPlatformWallet(tx, currency);
      await tx.$queryRawUnsafe(
        `SELECT * FROM "Wallet" WHERE id = $1 FOR UPDATE`,
        platformWallet.id,
      );

      const propertyEscrowWallet = await this.walletService.getPropertyEscrowWallet(
        tx,
        dto.propertyId,
        currency,
      );
      await tx.$queryRawUnsafe(
        `SELECT * FROM "Wallet" WHERE id = $1 FOR UPDATE`,
        propertyEscrowWallet.id,
      );

      const txRef = clientRef ?? `INV-${randomUUID()}`;

      const newUserBalance = fixMoney(userBalance.minus(totalCharge));
      await tx.wallet.update({
        where: { id: userWallet.id },
        data: { balance: moneyStr(newUserBalance) },
      });

      const newPlatformBalance = fixMoney(toDecimal(platformWallet.balance.toString()).plus(investmentFee));
      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: { balance: moneyStr(newPlatformBalance) },
      });

      const newEscrowBalance = fixMoney(toDecimal(propertyEscrowWallet.balance.toString()).plus(investmentAmount));
      await tx.wallet.update({
        where: { id: propertyEscrowWallet.id },
        data: { balance: moneyStr(newEscrowBalance) },
      });

      const ownershipPercent = fixOwnership(shares.div(sharesTotalDec).mul(100));
      // currentRaised is historical funding (cumulative); only increases on buy — never reduced on sell.
      const currentRaised = fixMoney(toDecimal(lockedProperty.currentRaised.toString())).plus(investmentAmount);

      const investment = await tx.investment.create({
        data: {
          userId,
          propertyId: dto.propertyId,
          amount: moneyStr(investmentAmount),
          currency,
          shares: shareStr(shares),
          sharePrice: shareStr(sharePrice),
          ownershipPercent: fixOwnership(ownershipPercent).toFixed(6),
          status: InvestmentStatus.ACTIVE,
          clientReference: clientRef ?? null,
        },
      });

      const newStatus =
        newSharesSold.gte(sharesTotalDec) ? PropertyStatus.CLOSED : lockedProperty.status;

      await tx.property.update({
        where: { id: dto.propertyId },
        data: {
          sharesSold: shareStr(newSharesSold),
          currentRaised: moneyStr(currentRaised),
          status: newStatus,
        },
      });

      /**
       * BUY leg — user wallet (liquid) debited for principal + fee.
       * amount = totalCharge, fee = platform take, netAmount = principal routed to escrow.
       */
      await tx.transaction.create({
        data: {
          walletId: userWallet.id,
          userId,
          reference: txRef,
          groupId: txRef,
          type: TransactionType.BUY,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(totalCharge),
          fee: moneyStr(investmentFee),
          netAmount: moneyStr(investmentAmount),
          currency,
          direction: TransactionDirection.DEBIT,
          propertyId: dto.propertyId,
          investmentId: investment.id,
          metadata: {
            propertyId: dto.propertyId,
            investmentId: investment.id,
            sharePrice: shareStr(sharePrice),
            shares: shareStr(shares),
            feeType: 'INVESTMENT_FEE_ON_TOP',
            ledgerRole: 'USER_BUY_DEBIT',
            groupId: txRef,
          },
        },
      });

      /** Principal to property escrow (not spendable by users — position capital). */
      await tx.transaction.create({
        data: {
          walletId: propertyEscrowWallet.id,
          userId: null,
          reference: `${txRef}-ESCROW`,
          groupId: txRef,
          type: TransactionType.PROPERTY_FUNDING,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(investmentAmount),
          fee: null,
          netAmount: moneyStr(investmentAmount),
          currency,
          direction: TransactionDirection.CREDIT,
          propertyId: dto.propertyId,
          investmentId: investment.id,
          metadata: {
            propertyId: dto.propertyId,
            investmentId: investment.id,
            shares: shareStr(shares),
            ledgerRole: 'ESCROW_PRINCIPAL',
            groupId: txRef,
          },
        },
      });

      /** Platform revenue from buy spread. */
      await tx.transaction.create({
        data: {
          walletId: platformWallet.id,
          userId: PLATFORM_USER_ID,
          reference: `${txRef}-FEE`,
          groupId: txRef,
          type: TransactionType.FEE,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(investmentFee),
          fee: moneyStr(investmentFee),
          netAmount: moneyStr(investmentFee),
          currency,
          direction: TransactionDirection.CREDIT,
          propertyId: dto.propertyId,
          investmentId: investment.id,
          metadata: {
            propertyId: dto.propertyId,
            investmentId: investment.id,
            feeType: 'INVESTMENT_FEE',
            ledgerRole: 'PLATFORM_FEE',
            groupId: txRef,
          },
        },
      });

      const updatedUserWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: userWallet.id },
      });
      return { investment, updatedUserWallet };
    });

    // Send notification after successful investment (outside transaction)
    try {
      await this.notificationsService.notifyInvestmentSuccess(
        userId,
        property.title,
        formatMoney(toDecimal(result.investment.amount.toString())),
        result.investment.currency,
        result.investment.id,
      );
    } catch (err) {
      this.logger.warn(`Failed to send investment success notification: ${err}`);
    }

    return {
      investmentId: result.investment.id,
      propertyId: dto.propertyId,
      amount: formatMoney(toDecimal(result.investment.amount.toString())),
      investmentFee: formatMoney(toDecimal(result.investment.amount.toString()).mul(INVESTMENT_FEE_RATE)),
      totalCharge: formatMoney(
        toDecimal(result.investment.amount.toString()).mul(1 + INVESTMENT_FEE_RATE),
      ),
      shares: formatHighPrecision(toDecimal(result.investment.shares.toString())),
      sharePrice: formatHighPrecision(toDecimal(result.investment.sharePrice.toString())),
      ownershipPercent: toDecimal(result.investment.ownershipPercent.toString()).toFixed(6),
      walletBalanceAfter: formatMoney(toDecimal(result.updatedUserWallet.balance.toString())),
    };
  }

  /**
   * Sell fractional shares — FIFO across the user's investment rows for this property.
   *
   * FIXED vs prior codebase: there was no atomic sell; this enforces:
   * - profit-only fee (10% of gain vs average cost basis),
   * - escrow / platform / user wallet separation with full ledger rows (fee + netAmount).
   */
  async sellFractional(userId: string, dto: SellFractionalInvestmentDto) {
    const sharesToSell = toDecimal(dto.sharesToSell);
    if (sharesToSell.lte(0)) {
      throw new BadRequestException('sharesToSell must be positive');
    }

    const clientRef = dto.clientReference?.trim();
    if (clientRef) {
      const existingTx = await this.prisma.transaction.findUnique({
        where: { reference: clientRef },
      });
      if (existingTx) {
        throw new ConflictException('Duplicate client reference for sell');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [lockedProperty] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Property" WHERE id = $1 AND "deletedAt" IS NULL FOR UPDATE`,
        dto.propertyId,
      );
      if (!lockedProperty) {
        throw new NotFoundException('Property not found');
      }

      const property = await tx.property.findUniqueOrThrow({ where: { id: dto.propertyId } });
      const currency = property.currency;
      /** Listing price — must match every position's locked sharePrice (fixed-price model). */
      const sharePrice = fixShare(toDecimal(property.sharePrice.toString()));

      const positions = await tx.investment.findMany({
        where: {
          userId,
          propertyId: dto.propertyId,
          status: InvestmentStatus.ACTIVE,
        },
        orderBy: { createdAt: 'asc' },
      });

      let available = new Decimal(0);
      for (const p of positions) {
        available = available.plus(toDecimal(p.shares.toString()));
      }
      if (available.lt(sharesToSell)) {
        throw new BadRequestException('Insufficient shares to sell');
      }

      type Slice = { investmentId: string; take: Decimal };
      const slices: Slice[] = [];
      let remaining = sharesToSell;
      for (const pos of positions) {
        if (remaining.lte(0)) break;
        const posShares = toDecimal(pos.shares.toString());
        if (posShares.lte(0)) continue;
        const take = Decimal.min(posShares, remaining);
        slices.push({ investmentId: pos.id, take });
        remaining = remaining.minus(take);
      }

      // Dynamic pricing disabled until liquidity system is implemented — escrow only guarantees principal at original price.
      for (const s of slices) {
        const pos = positions.find((p) => p.id === s.investmentId)!;
        const posPx = fixShare(toDecimal(pos.sharePrice.toString()));
        if (!posPx.eq(sharePrice)) {
          throw new BadRequestException(
            'Dynamic pricing disabled until liquidity system is implemented',
          );
        }
      }

      const sellAmount = fixMoney(sharePrice.mul(sharesToSell));
      let costBasis = new Decimal(0);
      for (const s of slices) {
        const pos = positions.find((p) => p.id === s.investmentId)!;
        const posShares = toDecimal(pos.shares.toString());
        const posAmount = toDecimal(pos.amount.toString());
        const sliceCost = fixMoney(s.take.mul(posAmount.div(posShares)));
        costBasis = costBasis.plus(sliceCost);
      }
      costBasis = fixMoney(costBasis);

      const profit = fixMoney(sellAmount.minus(costBasis));
      const platformFee = profit.gt(0) ? fixMoney(profit.mul(SELL_PROFIT_FEE_RATE)) : new Decimal(0);
      const netToUser = fixMoney(sellAmount.minus(platformFee));

      const userWallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });
      if (!userWallet) {
        throw new NotFoundException('Wallet not found for currency');
      }

      const propertyEscrowWallet = await this.walletService.getPropertyEscrowWallet(
        tx,
        dto.propertyId,
        currency,
      );
      const platformWallet = await this.walletService.getPlatformWallet(tx, currency);

      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, userWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, propertyEscrowWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, platformWallet.id);

      const lockedEscrow = await tx.wallet.findUniqueOrThrow({ where: { id: propertyEscrowWallet.id } });
      const lockedPlatform = await tx.wallet.findUniqueOrThrow({ where: { id: platformWallet.id } });
      const lockedUserW = await tx.wallet.findUniqueOrThrow({ where: { id: userWallet.id } });

      const escrowBal = toDecimal(lockedEscrow.balance.toString());
      if (escrowBal.lt(sellAmount)) {
        throw new BadRequestException('Insufficient escrow liquidity for this sale (contact support)');
      }

      const sharesSoldDec = toDecimal(property.sharesSold.toString());
      const newSharesSold = sharesSoldDec.minus(sharesToSell);
      if (newSharesSold.lt(0)) {
        throw new BadRequestException('Property shares sold would underflow');
      }

      const sharesTotalDec = toDecimal(property.sharesTotal.toString());
      let newStatus = property.status;
      if (newSharesSold.lt(sharesTotalDec) && property.status === PropertyStatus.CLOSED) {
        newStatus = PropertyStatus.PUBLISHED;
      }

      // currentRaised is historical funding metric, not live liquidity — do not decrement on sell.
      await tx.property.update({
        where: { id: dto.propertyId },
        data: {
          sharesSold: shareStr(newSharesSold),
          status: newStatus,
        },
      });

      for (const s of slices) {
        const pos = positions.find((p) => p.id === s.investmentId)!;
        const posShares = toDecimal(pos.shares.toString());
        const posAmount = toDecimal(pos.amount.toString());
        const newShares = posShares.minus(s.take);
        const redeemedCost = fixMoney(s.take.mul(posAmount.div(posShares)));
        const newAmount = fixMoney(posAmount.minus(redeemedCost));
        const sharesTotalProp = toDecimal(property.sharesTotal.toString());
        const ownPct = newShares.lte(0)
          ? new Decimal(0)
          : fixOwnership(newShares.div(sharesTotalProp).mul(100));

        await tx.investment.update({
          where: { id: pos.id },
          data: {
            shares: shareStr(newShares),
            amount: moneyStr(newAmount),
            ownershipPercent: ownPct.toFixed(6),
            status: newShares.lte(0) ? InvestmentStatus.COMPLETED : InvestmentStatus.ACTIVE,
          },
        });
      }

      const newUserBal = fixMoney(toDecimal(lockedUserW.balance.toString()).plus(netToUser));
      const newEscrowBal = fixMoney(escrowBal.minus(sellAmount));
      const newPlatformBal = fixMoney(toDecimal(lockedPlatform.balance.toString()).plus(platformFee));

      await tx.wallet.update({
        where: { id: userWallet.id },
        data: { balance: moneyStr(newUserBal) },
      });
      await tx.wallet.update({
        where: { id: propertyEscrowWallet.id },
        data: { balance: moneyStr(newEscrowBal) },
      });
      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: { balance: moneyStr(newPlatformBal) },
      });

      const txRef = clientRef ?? `SELL-${randomUUID()}`;

      await tx.transaction.create({
        data: {
          walletId: userWallet.id,
          userId,
          reference: txRef,
          groupId: txRef,
          type: TransactionType.SELL,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(sellAmount),
          fee: moneyStr(platformFee),
          netAmount: moneyStr(netToUser),
          currency,
          direction: TransactionDirection.CREDIT,
          propertyId: dto.propertyId,
          metadata: {
            propertyId: dto.propertyId,
            shares: shareStr(sharesToSell),
            sharesToSell: shareStr(sharesToSell),
            costBasis: moneyStr(costBasis),
            profit: moneyStr(profit),
            ledgerRole: 'USER_SELL_PROCEEDS',
            groupId: txRef,
          },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: propertyEscrowWallet.id,
          userId: null,
          reference: `${txRef}-ESCROW`,
          groupId: txRef,
          type: TransactionType.PROPERTY_FUNDING,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(sellAmount),
          fee: null,
          netAmount: moneyStr(sellAmount),
          currency,
          direction: TransactionDirection.DEBIT,
          propertyId: dto.propertyId,
          metadata: {
            propertyId: dto.propertyId,
            ledgerRole: 'ESCROW_RELEASE_ON_SELL',
            groupId: txRef,
          },
        },
      });

      if (platformFee.gt(0)) {
        await tx.transaction.create({
          data: {
            walletId: platformWallet.id,
            userId: PLATFORM_USER_ID,
            reference: `${txRef}-FEE`,
            groupId: txRef,
            type: TransactionType.FEE,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(platformFee),
            fee: moneyStr(platformFee),
            netAmount: moneyStr(platformFee),
            currency,
            direction: TransactionDirection.CREDIT,
            propertyId: dto.propertyId,
            metadata: {
              propertyId: dto.propertyId,
              feeType: 'SELL_PROFIT_FEE',
              ledgerRole: 'PLATFORM_FEE',
              groupId: txRef,
            },
          },
        });
      }

      const uw = await tx.wallet.findUniqueOrThrow({ where: { id: userWallet.id } });
      const primaryInvestmentId = slices[0]?.investmentId;
      return {
        sellAmount: formatMoney(sellAmount),
        fee: formatMoney(platformFee),
        netToUser: formatMoney(netToUser),
        costBasis: formatMoney(costBasis),
        walletBalanceAfter: formatMoney(toDecimal(uw.balance.toString())),
        primaryInvestmentId,
      };
    });

    /** Audit trail: settlement triple (user net / escrow gross / platform fee) must reconcile to gross proceeds. */
    this.logger.log(
      `SELL_SETTLED user=${userId} property=${dto.propertyId} sharesToSell=${dto.sharesToSell} gross=${result.sellAmount} platformFee=${result.fee} netToUser=${result.netToUser} costBasis=${result.costBasis}`,
    );

    // Send notification after successful sell (outside transaction)
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: dto.propertyId },
        select: { title: true, currency: true },
      });
      if (property && result.primaryInvestmentId) {
        await this.notificationsService.notifyInvestmentSold(
          userId,
          property.title,
          result.netToUser,
          property.currency,
          result.primaryInvestmentId,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send investment sold notification: ${err}`);
    }

    return result;
  }

  /**
   * Automated ROI: monthlyYield = annualYield / 12, applied to each ACTIVE position's principal.
   * Gross ROI is funded from property escrow; platform takes 3%; remainder credits the user.
   * Persisted source of truth: `InvestmentReturn` rows + `Transaction` type ROI (same atomic tx).
   */
  async distributeROI(propertyId: string, options?: { adminId?: string; period?: string }) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.annualYield == null) {
      throw new BadRequestException('Property has no annualYield set (cannot auto-distribute)');
    }

    const annualYield = toDecimal(property.annualYield.toString());
    if (annualYield.lte(0)) {
      throw new BadRequestException('annualYield must be positive');
    }

    const monthlyYield = annualYield.div(12).toDecimalPlaces(12, Decimal.ROUND_DOWN);
    const period =
      options?.period ??
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;

    const txResult = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Property" WHERE id = $1 FOR UPDATE`,
        propertyId,
      );
      if (!locked) {
        throw new NotFoundException('Property not found');
      }

      const investments = await tx.investment.findMany({
        where: { propertyId, status: InvestmentStatus.ACTIVE },
        orderBy: { id: 'asc' },
      });

      type Payout = {
        investmentId: string;
        userId: string;
        currency: typeof property.currency;
        roiGross: Decimal;
        platformFee: Decimal;
        netRoi: Decimal;
      };

      const payouts: Payout[] = [];
      for (const inv of investments) {
        const principal = toDecimal(inv.amount.toString());
        if (principal.lte(0)) {
          continue;
        }
        const dup = await tx.investmentReturn.findFirst({
          where: { investmentId: inv.id, period },
        });
        if (dup) {
          this.logger.debug(`Skipping ROI for ${inv.id} — already paid for ${period}`);
          continue;
        }
        const roiGross = fixMoney(principal.mul(monthlyYield));
        if (roiGross.lte(0)) {
          continue;
        }
        const platformFee = fixMoney(roiGross.mul(MONTHLY_ROI_PLATFORM_FEE_RATE));
        const netRoi = fixMoney(roiGross.minus(platformFee));
        payouts.push({
          investmentId: inv.id,
          userId: inv.userId,
          currency: property.currency,
          roiGross,
          platformFee,
          netRoi,
        });
      }

      type Eligible = Payout & { walletId: string };
      const eligible: Eligible[] = [];
      for (const p of payouts) {
        const w = await tx.wallet.findUnique({
          where: { userId_currency: { userId: p.userId, currency: p.currency } },
        });
        if (!w) {
          this.logger.warn(`Skipping ROI for user ${p.userId} — no ${p.currency} wallet`);
          continue;
        }
        eligible.push({ ...p, walletId: w.id });
      }

      const totalGross = eligible.reduce((a, p) => a.plus(p.roiGross), new Decimal(0));
      const totalPlatformFees = eligible.reduce((a, p) => a.plus(p.platformFee), new Decimal(0));

      if (totalGross.lte(0)) {
        return {
          propertyId,
          investorsPaid: 0,
          totalGrossRoi: moneyStr(new Decimal(0)),
          platformFees: moneyStr(new Decimal(0)),
          currency: property.currency,
          period,
          message: 'No payouts (nothing to distribute or already processed for this period)',
        };
      }

      const escrowWallet = await this.walletService.getPropertyEscrowWallet(tx, propertyId, property.currency);
      const platformWallet = await this.walletService.getPlatformWallet(tx, property.currency);

      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, escrowWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, platformWallet.id);

      const escrowBal = toDecimal(
        (await tx.wallet.findUniqueOrThrow({ where: { id: escrowWallet.id } })).balance.toString(),
      );
      if (escrowBal.lt(totalGross)) {
        throw new BadRequestException('Insufficient property escrow to fund monthly ROI');
      }

      let escrowRunning = escrowBal;
      let platformRunning = fixMoney(toDecimal(platformWallet.balance.toString()));

      const groupId = `ROI-${propertyId}-${period}`;

      for (const p of eligible) {
        await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, p.walletId);

        const lockedUser = await tx.wallet.findUniqueOrThrow({ where: { id: p.walletId } });
        const newUserBal = fixMoney(toDecimal(lockedUser.balance.toString()).plus(p.netRoi));

        await tx.wallet.update({
          where: { id: p.walletId },
          data: { balance: moneyStr(newUserBal) },
        });

        escrowRunning = fixMoney(escrowRunning.minus(p.roiGross));

        const invRow = await tx.investment.findUniqueOrThrow({ where: { id: p.investmentId } });
        const newTotalReturns = fixMoney(toDecimal(invRow.totalReturns.toString()).plus(p.netRoi));
        await tx.investment.update({
          where: { id: p.investmentId },
          data: { totalReturns: moneyStr(newTotalReturns) },
        });

        await tx.investmentReturn.create({
          data: {
            userId: p.userId,
            propertyId,
            investmentId: p.investmentId,
            amount: moneyStr(p.roiGross),
            fee: moneyStr(p.platformFee),
            netAmount: moneyStr(p.netRoi),
            period,
            status: 'PAID',
          },
        });

        await tx.transaction.create({
          data: {
            walletId: p.walletId,
            userId: p.userId,
            reference: `${groupId}-${p.investmentId}-USER`,
            groupId,
            type: TransactionType.ROI,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(p.roiGross),
            fee: moneyStr(p.platformFee),
            netAmount: moneyStr(p.netRoi),
            currency: p.currency,
            direction: TransactionDirection.CREDIT,
            propertyId,
            investmentId: p.investmentId,
            metadata: {
              propertyId,
              investmentId: p.investmentId,
              period,
              ledgerRole: 'monthly_yield_roi',
              groupId,
            },
          },
        });
      }

      platformRunning = fixMoney(platformRunning.plus(totalPlatformFees));
      await tx.wallet.update({
        where: { id: escrowWallet.id },
        data: { balance: moneyStr(escrowRunning) },
      });
      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: { balance: moneyStr(platformRunning) },
      });

      if (totalPlatformFees.gt(0)) {
        await tx.transaction.create({
          data: {
            walletId: platformWallet.id,
            userId: PLATFORM_USER_ID,
            reference: `${groupId}-PLATFORM-FEE`,
            groupId,
            type: TransactionType.FEE,
            status: TransactionStatus.COMPLETED,
            amount: moneyStr(totalPlatformFees),
            fee: moneyStr(totalPlatformFees),
            netAmount: moneyStr(totalPlatformFees),
            currency: property.currency,
            direction: TransactionDirection.CREDIT,
            propertyId,
            metadata: {
              propertyId,
              feeType: 'MONTHLY_ROI_PLATFORM',
              ledgerRole: 'PLATFORM_FEE_AGGREGATE',
              groupId,
            },
          },
        });
      }

      await tx.transaction.create({
        data: {
          walletId: escrowWallet.id,
          userId: null,
          reference: `${groupId}-ESCROW`,
          groupId,
          type: TransactionType.PROPERTY_FUNDING,
          status: TransactionStatus.COMPLETED,
          amount: moneyStr(totalGross),
          fee: null,
          netAmount: moneyStr(totalGross),
          currency: property.currency,
          direction: TransactionDirection.DEBIT,
          propertyId,
          metadata: {
            propertyId,
            ledgerRole: 'ESCROW_FUND_MONTHLY_ROI',
            grossTotal: moneyStr(totalGross),
            groupId,
          },
        },
      });

      if (options?.adminId) {
        await tx.adminActivityLog.create({
          data: {
            adminId: options.adminId,
            action: 'DISTRIBUTE_MONTHLY_ROI',
            entityType: 'PROPERTY',
            entityId: propertyId,
            metadata: {
              totalGross: moneyStr(totalGross),
              platformFees: moneyStr(totalPlatformFees),
              investorsPaid: eligible.length,
              currency: property.currency,
              period,
              groupId,
            },
          },
        });
      }

      return {
        propertyId,
        investorsPaid: eligible.length,
        totalGrossRoi: formatMoney(totalGross),
        platformFees: formatMoney(totalPlatformFees),
        currency: property.currency,
        batchReference: groupId,
        period,
        // Pass eligible payouts for notification (userId, netRoi, currency)
        _eligiblePayouts: eligible.map((p) => ({
          userId: p.userId,
          netRoi: moneyStr(p.netRoi),
          currency: p.currency,
        })),
        _propertyTitle: property.title,
      };
    });

    // Send ROI notifications after transaction completes (fire-and-forget pattern)
    if ((txResult as any)._eligiblePayouts?.length > 0) {
      const payouts = (txResult as any)._eligiblePayouts as Array<{
        userId: string;
        netRoi: string;
        currency: string;
      }>;
      const propertyTitle = (txResult as any)._propertyTitle as string;

      // Send notifications asynchronously to not block the response
      setImmediate(async () => {
        for (const payout of payouts) {
          try {
            await this.notificationsService.notifyRoiCredited(
              payout.userId,
              propertyTitle,
              payout.netRoi,
              payout.currency,
              txResult.period,
            );
          } catch (err) {
            this.logger.warn(`Failed to send ROI notification for user ${payout.userId}: ${err}`);
          }
        }
      });
    }

    // Remove internal fields from response
    const { _eligiblePayouts, _propertyTitle, ...cleanResult } = txResult as any;
    return cleanResult;
  }

  /**
   * Internal audit: each wallet balance should match the net of its COMPLETED ledger rows.
   * Does not prove global conservation (needs genesis balances) but catches drift / double-credits.
   */
  async verifySystemIntegrity() {
    const wallets = await this.prisma.wallet.findMany({
      select: { id: true, balance: true, userId: true, currency: true },
    });
    const warnings: string[] = [];
    for (const w of wallets) {
      const txs = await this.prisma.transaction.findMany({
        where: { walletId: w.id, status: TransactionStatus.COMPLETED },
        select: { amount: true, direction: true },
      });
      let expected = new Decimal(0);
      for (const t of txs) {
        const amt = toDecimal(t.amount.toString());
        expected = t.direction === TransactionDirection.CREDIT ? expected.plus(amt) : expected.minus(amt);
      }
      const actual = fixMoney(toDecimal(w.balance.toString()));
      if (!actual.eq(fixMoney(expected))) {
        warnings.push(
          `Wallet ${w.id} (${w.currency}): stored ${moneyStr(actual)} vs sum(ledger) ${moneyStr(expected)}`,
        );
      }
    }
    const totalBalances = wallets.reduce((a, w) => a.plus(toDecimal(w.balance.toString())), new Decimal(0));
    return {
      ok: warnings.length === 0,
      totalWalletBalances: moneyStr(fixMoney(totalBalances)),
      walletsChecked: wallets.length,
      warnings,
    };
  }

  private formatInvestmentResponse(
    investment: { id: string; propertyId: string; amount: unknown; currency: string; shares: unknown; sharePrice: unknown; ownershipPercent: unknown },
    wallet: { balance: { toString(): string } } | null,
  ) {
    const amountDec = toDecimal(String(investment.amount));
    return {
      investmentId: investment.id,
      propertyId: investment.propertyId,
      amount: formatMoney(amountDec),
      investmentFee: formatMoney(amountDec.mul(INVESTMENT_FEE_RATE)),
      totalCharge: formatMoney(amountDec.mul(1 + INVESTMENT_FEE_RATE)),
      shares: formatHighPrecision(toDecimal(String(investment.shares))),
      sharePrice: formatHighPrecision(toDecimal(String(investment.sharePrice))),
      ownershipPercent: toDecimal(String(investment.ownershipPercent)).toFixed(6),
      walletBalanceAfter: wallet
        ? formatMoney(toDecimal(wallet.balance.toString()))
        : '0.0000',
    };
  }

  async getInvestment(id: string) {
    const investment = await this.prisma.investment.findUnique({
      where: { id },
      include: { property: true },
    });
    if (!investment) {
      throw new NotFoundException('Investment not found');
    }
    return investment;
  }

  async initializeInvestmentPayment(
    userId: string,
    propertyId: string,
    shares: string,
    email: string,
  ) {
    const sharesDec = toDecimal(shares);
    if (sharesDec.lte(0) || !sharesDec.isInteger()) {
      throw new BadRequestException('Shares must be a positive integer');
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (property.status !== PropertyStatus.PUBLISHED) {
      throw new BadRequestException('Property is not open for investment');
    }

    const sharePrice = fixShare(toDecimal(property.sharePrice.toString()));
    const investmentAmount = fixMoney(sharePrice.mul(sharesDec));
    const investmentFee = fixMoney(investmentAmount.mul(INVESTMENT_FEE_RATE));
    const totalCharge = fixMoney(investmentAmount.plus(investmentFee));
/*
    return this.paystackService.createPaymentIntent(totalCharge, email, property.currency, {
      type: 'investment',
      propertyId,
      shares,
      userId,
    });
  }*/
  return this.paystackService.createPaymentIntent(
    new Decimal(totalCharge), // Wrap if it's currently a number
    email, 
    property.currency, 
    {
      propertyId: property.id,
      shares,
      userId,
    });
  }

  async getInvestmentsByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.investment.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              description: true,
              location: true,
              totalValue: true,
              sharePrice: true,
              currency: true,
              sharesTotal: true,
              sharesSold: true,
              currentRaised: true,
              annualYield: true,
            },
          },
        },
      }),
      this.prisma.investment.count({ where: { userId } }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }
}
