/**
 * Issue 3 — concurrent conditional debit (real Postgres + Prisma).
 *
 * **Infrastructure:** This spec exercises true DB row locks and conditional `UPDATE … WHERE balance >=`.
 * It does **not** run in default `npm test` (no disposable database assumed).
 *
 * Enable with:
 *   `RUN_LEDGER_CONCURRENCY_INTEGRATION=1` and a valid `DATABASE_URL` (Postgres, migrated schema).
 *
 * The database must allow DDL/DML for ephemeral test rows; use a local or CI disposable instance.
 * If neither variable is set, the suite is skipped so CI stays green without Postgres.
 *
 * What this proves: two `postDoubleEntry` calls that each debit the same wallet cannot both commit;
 * one fails closed with insufficient balance and leaves **no** `Transaction` / `LedgerOperation` rows
 * for that reference (interactive transaction rollback).
 */
import { BadRequestException } from '@nestjs/common';
import {
  Currency,
  LedgerOperationType,
  PrismaClient,
  TransactionDirection,
  TransactionType,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { WalletService } from './wallet.service';

const shouldRun =
  process.env.RUN_LEDGER_CONCURRENCY_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL?.trim());

const describeIntegration = shouldRun ? describe : describe.skip;

describeIntegration('WalletService.postDoubleEntry — concurrent debit overspend prevention', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaClient;
  let walletService: WalletService;
  const runTag = randomUUID().slice(0, 8);
  const userAEmail = `conc-a-${runTag}@ledger-integration.test`;
  const userBEmail = `conc-b-${runTag}@ledger-integration.test`;
  let userAId: string;
  let userBId: string;
  let walletAId: string;
  let walletBId: string;
  const ref1 = `CONC-${runTag}-1`;
  const ref2 = `CONC-${runTag}-2`;

  const legs = () => [
    {
      walletId: walletAId,
      userId: userAId,
      type: TransactionType.P2P_TRANSFER,
      direction: TransactionDirection.DEBIT,
      amount: new Decimal('80.0000'),
      currency: Currency.NGN,
    },
    {
      walletId: walletBId,
      userId: userBId,
      type: TransactionType.P2P_TRANSFER,
      direction: TransactionDirection.CREDIT,
      amount: new Decimal('80.0000'),
      currency: Currency.NGN,
    },
  ];

  const postOpts = {
    operationType: LedgerOperationType.TRANSFER,
    sourceModule: 'integration-test',
    sourceId: runTag,
  } as const;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    walletService = new WalletService(prisma as never, {} as never, { notifyWalletFunded: jest.fn() } as never);

    userAId = randomUUID();
    userBId = randomUUID();
    await prisma.user.createMany({
      data: [
        { id: userAId, email: userAEmail, passwordHash: 'INTEGRATION_NO_LOGIN' },
        { id: userBId, email: userBEmail, passwordHash: 'INTEGRATION_NO_LOGIN' },
      ],
    });
    await prisma.wallet.createMany({
      data: [
        { id: (walletAId = randomUUID()), userId: userAId, currency: Currency.NGN, balance: '100.0000' },
        { id: (walletBId = randomUUID()), userId: userBId, currency: Currency.NGN, balance: '0.0000' },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.transaction.deleteMany({
        where: { OR: [{ walletId: walletAId }, { walletId: walletBId }] },
      });
      await prisma.ledgerOperation.deleteMany({
        where: { OR: [{ reference: ref1 }, { reference: ref2 }] },
      });
      await prisma.wallet.deleteMany({ where: { id: { in: [walletAId, walletBId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows exactly one of two concurrent 80 debits from a 100 balance wallet; rolls back the loser', async () => {
    const settled = await Promise.allSettled([
      prisma.$transaction((tx) => walletService.postDoubleEntry(tx, ref1, legs(), postOpts)),
      prisma.$transaction((tx) => walletService.postDoubleEntry(tx, ref2, legs(), postOpts)),
    ]);

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s) => s.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const err = rejected[0].reason;
    expect(err).toBeInstanceOf(BadRequestException);
    expect(String((err as BadRequestException).message)).toMatch(/Insufficient wallet balance for ledger debit/i);

    const wA = await prisma.wallet.findUniqueOrThrow({ where: { id: walletAId } });
    expect(new Decimal(wA.balance.toString()).toFixed(4)).toBe('20.0000');

    const wB = await prisma.wallet.findUniqueOrThrow({ where: { id: walletBId } });
    expect(new Decimal(wB.balance.toString()).toFixed(4)).toBe('80.0000');

    const opCount = await prisma.ledgerOperation.count({
      where: { reference: { in: [ref1, ref2] } },
    });
    expect(opCount).toBe(1);

    const txCount1 = await prisma.transaction.count({ where: { reference: ref1 } });
    const txCount2 = await prisma.transaction.count({ where: { reference: ref2 } });
    const successRef = txCount1 === 2 ? ref1 : ref2;
    const failRef = successRef === ref1 ? ref2 : ref1;
    expect(txCount1 + txCount2).toBe(2);
    expect(await prisma.transaction.count({ where: { reference: failRef } })).toBe(0);

    const op = await prisma.ledgerOperation.findFirstOrThrow({
      where: { reference: successRef },
      include: { transactions: true },
    });
    expect(op.transactions).toHaveLength(2);
  });
});
