/**
 * Legacy one-off: backfill `LedgerOperation` + `Transaction` legs for wallets that already have a
 * non-zero `Wallet.balance` but no genesis reference, **without** mutating `Wallet.balance`.
 *
 * Do **not** use `WalletService.postDoubleEntry` here — that path applies balance deltas and would
 * double-count balances that are already authoritative in `Wallet`.
 *
 * Requires: `ALLOW_LEGACY_LEDGER_SCRIPT=true`
 *
 * Rows are tagged in metadata for reconciliation (`legacyGenesisBackfill`, `noWalletBalanceMutation`).
 */
import {
  Currency,
  LedgerOperationStatus,
  LedgerOperationType,
  Prisma,
  PrismaClient,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { toDecimal } from '../common/money/decimal.util';
import { fixMoney, moneyStr } from '../common/money/precision.constants';
import { fingerprintFromLegInputs } from '../modules/wallet/ledger-fingerprint.util';

const prisma = new PrismaClient();
const GENESIS_SYSTEM_USER_ID = 'GENESIS_SYSTEM_USER';

if (process.env.ALLOW_LEGACY_LEDGER_SCRIPT !== 'true') {
  console.error(
    'Refused: ledger-genesis is a legacy backfill only. Set ALLOW_LEGACY_LEDGER_SCRIPT=true to run.',
  );
  process.exit(1);
}

async function ensureGenesisSystemWallet(tx: Prisma.TransactionClient, currency: Currency) {
  await tx.user.upsert({
    where: { id: GENESIS_SYSTEM_USER_ID },
    update: {},
    create: {
      id: GENESIS_SYSTEM_USER_ID,
      email: 'genesis-system@internal.cohold',
      passwordHash: 'GENESIS_NO_LOGIN',
    },
  });
  return tx.wallet.upsert({
    where: { userId_currency: { userId: GENESIS_SYSTEM_USER_ID, currency } },
    update: {},
    create: {
      userId: GENESIS_SYSTEM_USER_ID,
      currency,
      balance: '0',
    },
  });
}

async function run() {
  const wallets = await prisma.wallet.findMany({
    select: { id: true, userId: true, currency: true, balance: true },
  });

  for (const wallet of wallets) {
    const amountDec = fixMoney(toDecimal(wallet.balance.toString()));
    if (amountDec.lte(0)) continue;

    const reference = `GENESIS-${wallet.id}`;
    const existingOp = await prisma.ledgerOperation.findUnique({ where: { reference } });
    if (existingOp) continue;

    const amount = moneyStr(amountDec);
    const currency = wallet.currency;

    const legInputs = [
      {
        walletId: '',
        userId: GENESIS_SYSTEM_USER_ID,
        direction: TransactionDirection.DEBIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: amountDec,
        currency,
        fee: null,
        netAmount: null,
        propertyId: null,
        investmentId: null,
        externalReference: null,
      },
      {
        walletId: '',
        userId: wallet.userId,
        direction: TransactionDirection.CREDIT,
        type: TransactionType.WALLET_TOP_UP,
        amount: amountDec,
        currency,
        fee: null,
        netAmount: null,
        propertyId: null,
        investmentId: null,
        externalReference: null,
      },
    ];

    await prisma.$transaction(async (tx) => {
      const systemWallet = await ensureGenesisSystemWallet(tx, currency);
      legInputs[0].walletId = systemWallet.id;

      const userWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      legInputs[1].walletId = userWallet.id;

      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, systemWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, userWallet.id);

      const fingerprint = fingerprintFromLegInputs(legInputs);

      const op = await tx.ledgerOperation.create({
        data: {
          reference,
          type: LedgerOperationType.LEGACY_UNKNOWN,
          status: LedgerOperationStatus.POSTED,
          currency,
          totalAmount: amount,
          legFingerprint: fingerprint,
          metadata: {
            legacyGenesisBackfill: true,
            noWalletBalanceMutation: true,
            sourceWalletId: systemWallet.id,
            targetWalletId: userWallet.id,
          },
          sourceModule: 'ledger-genesis-script',
          sourceId: wallet.id,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: systemWallet.id,
          userId: GENESIS_SYSTEM_USER_ID,
          reference,
          groupId: reference,
          type: TransactionType.WALLET_TOP_UP,
          status: TransactionStatus.COMPLETED,
          amount,
          currency,
          direction: TransactionDirection.DEBIT,
          metadata: {
            ledgerRole: 'GENESIS_SYSTEM_DEBIT',
            legacyGenesisBackfill: true,
            sourceWalletId: systemWallet.id,
            targetWalletId: userWallet.id,
          },
          ledgerOperationId: op.id,
          ledgerLegIndex: 0,
        },
      });
      await tx.transaction.create({
        data: {
          walletId: userWallet.id,
          userId: wallet.userId,
          reference,
          groupId: reference,
          type: TransactionType.WALLET_TOP_UP,
          status: TransactionStatus.COMPLETED,
          amount,
          currency,
          direction: TransactionDirection.CREDIT,
          metadata: {
            ledgerRole: 'GENESIS_WALLET_CREDIT',
            legacyGenesisBackfill: true,
            sourceWalletId: systemWallet.id,
            targetWalletId: userWallet.id,
          },
          ledgerOperationId: op.id,
          ledgerLegIndex: 1,
        },
      });
    });
  }
}

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
