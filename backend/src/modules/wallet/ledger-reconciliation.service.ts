import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionDirection, TransactionStatus } from '@prisma/client';
import { toDecimal } from '../../common/money/decimal.util';
import { fixMoney, moneyStr } from '../../common/money/precision.constants';
import Decimal from 'decimal.js';

export type WalletBalanceMismatch = {
  walletId: string;
  userId: string;
  currency: string;
  storedBalance: string;
  ledgerSum: string;
  delta: string;
};

export type UnbalancedOperation = {
  ledgerOperationId: string;
  reference: string;
  debitTotal: string;
  creditTotal: string;
};

export type ShortOperation = {
  ledgerOperationId: string;
  reference: string;
  legCount: number;
};

@Injectable()
export class LedgerReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async buildReport(): Promise<{
    generatedAt: string;
    walletBalanceMismatches: WalletBalanceMismatch[];
    transactionsWithoutLedgerOperation: number;
    unbalancedLedgerOperations: UnbalancedOperation[];
    shortLedgerOperations: ShortOperation[];
  }> {
    const [walletBalanceMismatches, transactionsWithoutLedgerOperation, ops] = await Promise.all([
      this.findWalletBalanceMismatches(),
      this.prisma.transaction.count({
        where: { ledgerOperationId: null, status: TransactionStatus.COMPLETED },
      }),
      this.prisma.ledgerOperation.findMany({
        include: {
          transactions: {
            where: { status: TransactionStatus.COMPLETED },
            select: { direction: true, amount: true },
          },
        },
      }),
    ]);

    const unbalancedLedgerOperations: UnbalancedOperation[] = [];
    const shortLedgerOperations: ShortOperation[] = [];

    for (const op of ops) {
      const legs = op.transactions;
      if (legs.length < 2) {
        shortLedgerOperations.push({
          ledgerOperationId: op.id,
          reference: op.reference,
          legCount: legs.length,
        });
        continue;
      }
      let debit = new Decimal(0);
      let credit = new Decimal(0);
      for (const t of legs) {
        const a = fixMoney(toDecimal(t.amount.toString()));
        if (t.direction === TransactionDirection.DEBIT) {
          debit = debit.plus(a);
        } else {
          credit = credit.plus(a);
        }
      }
      if (!fixMoney(debit).eq(fixMoney(credit))) {
        unbalancedLedgerOperations.push({
          ledgerOperationId: op.id,
          reference: op.reference,
          debitTotal: moneyStr(debit),
          creditTotal: moneyStr(credit),
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      walletBalanceMismatches,
      transactionsWithoutLedgerOperation,
      unbalancedLedgerOperations,
      shortLedgerOperations,
    };
  }

  private async findWalletBalanceMismatches(): Promise<WalletBalanceMismatch[]> {
    type Row = {
      walletId: string;
      userId: string;
      currency: string;
      storedBalance: unknown;
      ledgerSum: unknown;
    };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT w.id AS "walletId",
             w."userId" AS "userId",
             w.currency::text AS currency,
             w.balance AS "storedBalance",
             COALESCE(SUM(
               CASE
                 WHEN t.direction = 'CREDIT' THEN t.amount
                 WHEN t.direction = 'DEBIT' THEN -t.amount
                 ELSE 0
               END
             ), 0) AS "ledgerSum"
      FROM "Wallet" w
      LEFT JOIN "Transaction" t
        ON t."walletId" = w.id AND t.status = 'COMPLETED'
      GROUP BY w.id, w."userId", w.currency, w.balance
      HAVING w.balance <> COALESCE(SUM(
               CASE
                 WHEN t.direction = 'CREDIT' THEN t.amount
                 WHEN t.direction = 'DEBIT' THEN -t.amount
                 ELSE 0
               END
             ), 0)
    `;

    return rows.map((r) => {
      const stored = fixMoney(toDecimal(String(r.storedBalance)));
      const led = fixMoney(toDecimal(String(r.ledgerSum)));
      const delta = fixMoney(stored.minus(led));
      return {
        walletId: r.walletId,
        userId: r.userId,
        currency: r.currency,
        storedBalance: moneyStr(stored),
        ledgerSum: moneyStr(led),
        delta: moneyStr(delta),
      };
    });
  }
}
