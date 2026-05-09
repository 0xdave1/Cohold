/**
 * Issue 7 — real Postgres concurrency/idempotency proof for investment buy/sell.
 *
 * Run:
 *   RUN_INVESTMENT_CONCURRENCY_INTEGRATION=1 npm run test:investment-concurrency
 *
 * Strict preflight:
 * - flag missing -> suite skipped
 * - flag set + bad DB/schema/lock path -> suite fails loudly
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Currency,
  InvestmentStatus,
  LedgerOperationType,
  PrismaClient,
  PropertyStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { InvestmentService } from './investment.service';
import { PLATFORM_USER_ID, WalletService } from '../wallet/wallet.service';

const runRequested = process.env.RUN_INVESTMENT_CONCURRENCY_INTEGRATION === '1';
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
if (!runRequested) {
  console.warn(
    '[investment-concurrency.integration] Skipped: set RUN_INVESTMENT_CONCURRENCY_INTEGRATION=1 and DATABASE_URL to run this suite.',
  );
}
const describeIntegration = runRequested ? describe : describe.skip;

async function assertPreflight(prisma: PrismaClient): Promise<void> {
  if (!databaseUrl) {
    throw new Error(
      'RUN_INVESTMENT_CONCURRENCY_INTEGRATION=1 requires DATABASE_URL to be set.',
    );
  }
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error(`DATABASE_URL must be PostgreSQL. Received: ${databaseUrl}`);
  }

  await prisma.$queryRawUnsafe('SELECT 1');

  const migrationTableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS "exists"`,
  );
  if (!migrationTableExists[0]?.exists) {
    throw new Error(
      'Prisma migration table missing. Run `npx prisma migrate deploy` for the integration DB before this test.',
    );
  }

  const walletIdType = await prisma.$queryRawUnsafe<Array<{ data_type: string; udt_name: string }>>(
    `SELECT data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Wallet'
        AND column_name = 'id'`,
  );
  if (!walletIdType[0] || walletIdType[0].udt_name !== 'uuid') {
    throw new Error(
      `Schema mismatch: Wallet.id must be uuid for lock/update SQL path. Found: ${JSON.stringify(walletIdType[0] ?? null)}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" ORDER BY id LIMIT 1 FOR UPDATE`);
  });
}

describeIntegration('InvestmentService concurrency + idempotency integration', () => {
  jest.setTimeout(120_000);

  let prisma: PrismaClient;
  let walletService: WalletService;
  let investmentService: InvestmentService;

  const runTag = randomUUID().slice(0, 8);
  const buyerAId = randomUUID();
  const buyerBId = randomUUID();
  const sellerId = randomUUID();
  const propertyAId = randomUUID();
  const propertyBId = randomUUID();

  const buyerAEmail = `issue7-buy-a-${runTag}@integration.test`;
  const buyerBEmail = `issue7-buy-b-${runTag}@integration.test`;
  const sellerEmail = `issue7-sell-${runTag}@integration.test`;
  const platformEmail = `platform-${runTag}@system.internal`;
  const escrowAUserId = `ESCROW_PROPERTY_${propertyAId}`;
  const escrowBUserId = `ESCROW_PROPERTY_${propertyBId}`;
  const escrowAEmail = `${escrowAUserId.toLowerCase()}@system.internal`;
  const escrowBEmail = `${escrowBUserId.toLowerCase()}@system.internal`;

  const principal = new Decimal('100000.0000');
  const fee = principal.mul('0.02').toFixed(4);
  const totalCharge = principal.plus(fee).toFixed(4);

  const notifications = {
    notifyInvestmentSuccess: jest.fn(),
    notifyInvestmentSold: jest.fn(),
    notifyRoiCredited: jest.fn(),
  } as any;
  const kycPolicy = {
    assertUserKycVerifiedForMoneyMovement: jest.fn().mockResolvedValue(undefined),
  } as any;

  beforeAll(async () => {
    prisma = new PrismaClient({
      transactionOptions: {
        maxWait: 20_000,
        timeout: 20_000,
      },
    });
    await prisma.$connect();
    await assertPreflight(prisma);

    walletService = new WalletService(prisma as any, {} as any, { notifyWalletFunded: jest.fn() } as any);
    investmentService = new InvestmentService(prisma as any, walletService, notifications, kycPolicy);

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [buyerAId, buyerBId, sellerId, escrowAUserId, escrowBUserId],
        },
      },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [propertyAId, propertyBId] } },
    });

    await prisma.user.createMany({
      data: [
        { id: buyerAId, email: buyerAEmail, passwordHash: 'NO_LOGIN' },
        { id: buyerBId, email: buyerBEmail, passwordHash: 'NO_LOGIN' },
        { id: sellerId, email: sellerEmail, passwordHash: 'NO_LOGIN' },
      ],
    });
    await prisma.user.upsert({
      where: { id: PLATFORM_USER_ID },
      create: { id: PLATFORM_USER_ID, email: platformEmail, passwordHash: 'SYSTEM_NO_LOGIN' },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: escrowAUserId },
      create: { id: escrowAUserId, email: escrowAEmail, passwordHash: 'SYSTEM_NO_LOGIN' },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: escrowBUserId },
      create: { id: escrowBUserId, email: escrowBEmail, passwordHash: 'SYSTEM_NO_LOGIN' },
      update: {},
    });

    await prisma.wallet.deleteMany({
      where: {
        userId: {
          in: [buyerAId, buyerBId, sellerId, escrowAUserId, escrowBUserId],
        },
      },
    });
    await prisma.wallet.createMany({
      data: [
        { id: randomUUID(), userId: buyerAId, currency: Currency.NGN, balance: totalCharge },
        { id: randomUUID(), userId: buyerBId, currency: Currency.NGN, balance: totalCharge },
        { id: randomUUID(), userId: sellerId, currency: Currency.NGN, balance: '300000.0000' },
      ],
    });
    await prisma.wallet.upsert({
      where: { userId_currency: { userId: PLATFORM_USER_ID, currency: Currency.NGN } },
      create: { id: randomUUID(), userId: PLATFORM_USER_ID, currency: Currency.NGN, balance: '0.0000' },
      update: {},
    });
    await prisma.wallet.upsert({
      where: { userId_currency: { userId: escrowAUserId, currency: Currency.NGN } },
      create: { id: randomUUID(), userId: escrowAUserId, currency: Currency.NGN, balance: '0.0000' },
      update: {},
    });
    await prisma.wallet.upsert({
      where: { userId_currency: { userId: escrowBUserId, currency: Currency.NGN } },
      create: { id: randomUUID(), userId: escrowBUserId, currency: Currency.NGN, balance: '0.0000' },
      update: {},
    });

    await prisma.property.createMany({
      data: [
        {
          id: propertyAId,
          title: `Issue7 Property A ${runTag}`,
          description: 'Concurrency test property A',
          location: 'Lagos',
          status: PropertyStatus.PUBLISHED,
          totalValue: '100000.00000000',
          sharePrice: '10000.00000000',
          currency: Currency.NGN,
          minInvestment: '10000.0000',
          sharesTotal: '10.00000000',
          sharesSold: '0.00000000',
        },
        {
          id: propertyBId,
          title: `Issue7 Property B ${runTag}`,
          description: 'Idempotency conflict property B',
          location: 'Abuja',
          status: PropertyStatus.PUBLISHED,
          totalValue: '100000.00000000',
          sharePrice: '10000.00000000',
          currency: Currency.NGN,
          minInvestment: '10000.0000',
          sharesTotal: '100.00000000',
          sharesSold: '0.00000000',
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      await prisma.transaction.deleteMany({
        where: {
          OR: [{ userId: buyerAId }, { userId: buyerBId }, { userId: sellerId }],
        },
      });
      await prisma.ledgerOperation.deleteMany({
        where: {
          reference: {
            contains: `ISSUE7-${runTag}`,
          },
        },
      });
      await prisma.investmentReturn.deleteMany({ where: { userId: { in: [buyerAId, buyerBId, sellerId] } } });
      await prisma.investment.deleteMany({
        where: { userId: { in: [buyerAId, buyerBId, sellerId] } },
      });
      await prisma.wallet.deleteMany({
        where: {
          userId: {
            in: [buyerAId, buyerBId, sellerId, escrowAUserId, escrowBUserId],
          },
        },
      });
      await prisma.property.deleteMany({
        where: { id: { in: [propertyAId, propertyBId] } },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [buyerAId, buyerBId, sellerId, escrowAUserId, escrowBUserId],
          },
        },
      });
    } finally {
      if (prisma) {
        await prisma.$disconnect();
      }
    }
  });

  it('prevents concurrent oversell: exactly one buy succeeds and one fails', async () => {
    const refA = `ISSUE7-${runTag}-OVR-A`;
    const refB = `ISSUE7-${runTag}-OVR-B`;

    const settled = await Promise.allSettled([
      investmentService.createFractional(buyerAId, {
        propertyId: propertyAId,
        shares: '10',
        clientReference: refA,
      }),
      investmentService.createFractional(buyerBId, {
        propertyId: propertyAId,
        shares: '10',
        clientReference: refB,
      }),
    ]);

    const succeeded = settled.filter((s) => s.status === 'fulfilled');
    const failed = settled.filter((s) => s.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(BadRequestException);
    expect(String(failed[0].reason.message).toLowerCase()).toMatch(/not enough shares|available/);

    const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyAId } });
    expect(new Decimal(property.sharesSold.toString()).toFixed(8)).toBe('10.00000000');

    const investments = await prisma.investment.findMany({ where: { propertyId: propertyAId } });
    expect(investments).toHaveLength(1);

    const refs = [refA, refB];
    const opCount = await prisma.ledgerOperation.count({
      where: { reference: { in: refs }, type: LedgerOperationType.INVESTMENT_PURCHASE },
    });
    expect(opCount).toBe(1);

    const txCountA = await prisma.transaction.count({ where: { reference: refA } });
    const txCountB = await prisma.transaction.count({ where: { reference: refB } });
    expect(txCountA === 3 || txCountB === 3).toBe(true);
    expect(txCountA === 0 || txCountB === 0).toBe(true);
  });

  it('enforces buy idempotency: same key replay is safe, conflicting payload rejects', async () => {
    const idemRef = `ISSUE7-${runTag}-IDEMP-BUY`;

    const first = await investmentService.createFractional(buyerAId, {
      propertyId: propertyBId,
      shares: '10',
      clientReference: idemRef,
    });
    const replay = await investmentService.createFractional(buyerAId, {
      propertyId: propertyBId,
      shares: '10',
      clientReference: idemRef,
    });

    expect(replay.investmentId).toBe(first.investmentId);

    await expect(
      investmentService.createFractional(buyerAId, {
        propertyId: propertyAId,
        shares: '1',
        clientReference: idemRef,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const investments = await prisma.investment.findMany({
      where: { userId: buyerAId, propertyId: propertyBId, clientReference: idemRef },
    });
    expect(investments).toHaveLength(1);

    const ops = await prisma.ledgerOperation.findMany({ where: { reference: idemRef } });
    expect(ops).toHaveLength(1);

    const txs = await prisma.transaction.findMany({ where: { reference: idemRef } });
    expect(txs).toHaveLength(3);
  });

  it('prevents concurrent double-sell: one sell succeeds and one fails without double-credit', async () => {
    const sellerBuyRef = `ISSUE7-${runTag}-SELL-SEED`;
    await investmentService.createFractional(sellerId, {
      propertyId: propertyBId,
      shares: '10',
      clientReference: sellerBuyRef,
    });

    const sellerWalletBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId_currency: { userId: sellerId, currency: Currency.NGN } },
    });
    const beforeBal = new Decimal(sellerWalletBefore.balance.toString());

    const sellRefA = `ISSUE7-${runTag}-SELL-A`;
    const sellRefB = `ISSUE7-${runTag}-SELL-B`;
    const settled = await Promise.allSettled([
      investmentService.sellFractional(sellerId, {
        propertyId: propertyBId,
        sharesToSell: '10',
        clientReference: sellRefA,
      }),
      investmentService.sellFractional(sellerId, {
        propertyId: propertyBId,
        sharesToSell: '10',
        clientReference: sellRefB,
      }),
    ]);

    const succeeded = settled.filter((s) => s.status === 'fulfilled');
    const failed = settled.filter((s) => s.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(BadRequestException);
    expect(String(failed[0].reason.message).toLowerCase()).toMatch(/insufficient shares to sell/);

    const sellerPositions = await prisma.investment.findMany({
      where: { userId: sellerId, propertyId: propertyBId },
    });
    const ownedShares = sellerPositions.reduce(
      (acc, i) => acc.plus(new Decimal(i.shares.toString())),
      new Decimal(0),
    );
    expect(ownedShares.toFixed(8)).toBe('0.00000000');
    expect(sellerPositions.every((i) => i.status === InvestmentStatus.COMPLETED)).toBe(true);

    const saleOpCount = await prisma.ledgerOperation.count({
      where: {
        reference: { in: [sellRefA, sellRefB] },
        type: LedgerOperationType.INVESTMENT_SALE,
      },
    });
    expect(saleOpCount).toBe(1);

    const saleTxCountA = await prisma.transaction.count({ where: { reference: sellRefA } });
    const saleTxCountB = await prisma.transaction.count({ where: { reference: sellRefB } });
    expect(saleTxCountA === 2 || saleTxCountA === 3 || saleTxCountA === 0).toBe(true);
    expect(saleTxCountB === 2 || saleTxCountB === 3 || saleTxCountB === 0).toBe(true);
    expect(saleTxCountA === 0 || saleTxCountB === 0).toBe(true);

    const sellerWalletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId_currency: { userId: sellerId, currency: Currency.NGN } },
    });
    const afterBal = new Decimal(sellerWalletAfter.balance.toString());
    expect(afterBal.minus(beforeBal).toFixed(4)).toBe('100000.0000');
  });
});
