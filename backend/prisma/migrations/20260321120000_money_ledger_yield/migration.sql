-- Ledger columns, yield, ROI enum values (single migration; run once via `prisma migrate deploy`).

ALTER TABLE "Property" ADD COLUMN "annualYield" DECIMAL(12,8);

ALTER TABLE "Investment" ADD COLUMN "totalReturns" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "Transaction" ADD COLUMN "fee" DECIMAL(19,4);
ALTER TABLE "Transaction" ADD COLUMN "netAmount" DECIMAL(19,4);
ALTER TABLE "Transaction" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "investmentId" TEXT;

ALTER TYPE "TransactionType" ADD VALUE 'BUY';
ALTER TYPE "TransactionType" ADD VALUE 'SELL';
ALTER TYPE "TransactionType" ADD VALUE 'ROI';

CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");
CREATE INDEX "Transaction_investmentId_idx" ON "Transaction"("investmentId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
