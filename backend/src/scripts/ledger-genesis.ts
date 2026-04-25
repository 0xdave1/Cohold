import { PrismaClient, TransactionDirection, TransactionStatus, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();
const GENESIS_SYSTEM_USER_ID = 'GENESIS_SYSTEM_USER';

async function ensureGenesisSystemWallet(tx: any, currency: string) {
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
    where: { userId_currency: { userId: GENESIS_SYSTEM_USER_ID, currency: currency as any } },
    update: {},
    create: {
      userId: GENESIS_SYSTEM_USER_ID,
      currency: currency as any,
      balance: '0',
    },
  });
}

async function run() {
  const wallets = await prisma.wallet.findMany({
    select: { id: true, userId: true, currency: true, balance: true },
  });

  for (const wallet of wallets) {
    const amount = wallet.balance.toString();
    if (amount === '0.0000' || amount === '0') continue;

    const reference = `GENESIS-${wallet.id}`;
    const existing = await prisma.transaction.count({ where: { reference } });
    if (existing >= 2) continue;
    if (existing === 1) {
      throw new Error(`Corrupt genesis reference ${reference}: single leg exists`);
    }

    await prisma.$transaction(async (tx) => {
      const systemWallet = await ensureGenesisSystemWallet(tx as any, wallet.currency);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, systemWallet.id);
      await tx.$queryRawUnsafe(`SELECT id FROM "Wallet" WHERE id = $1 FOR UPDATE`, wallet.id);

      await tx.transaction.createMany({
        data: [
          {
            walletId: systemWallet.id,
            userId: GENESIS_SYSTEM_USER_ID,
            reference,
            groupId: reference,
            type: TransactionType.WALLET_TOP_UP,
            status: TransactionStatus.COMPLETED,
            amount,
            currency: wallet.currency,
            direction: TransactionDirection.DEBIT,
            metadata: {
              ledgerRole: 'GENESIS_SYSTEM_DEBIT',
              sourceWalletId: systemWallet.id,
              targetWalletId: wallet.id,
            },
          },
          {
            walletId: wallet.id,
            userId: wallet.userId,
            reference,
            groupId: reference,
            type: TransactionType.WALLET_TOP_UP,
            status: TransactionStatus.COMPLETED,
            amount,
            currency: wallet.currency,
            direction: TransactionDirection.CREDIT,
            metadata: {
              ledgerRole: 'GENESIS_WALLET_CREDIT',
              sourceWalletId: systemWallet.id,
              targetWalletId: wallet.id,
            },
          },
        ],
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

