-- Issue 3: DB-enforced ledger idempotency + operation grouping (non-destructive).
CREATE TYPE "LedgerOperationType" AS ENUM (
  'WALLET_FUNDING',
  'WITHDRAWAL_DEBIT',
  'WITHDRAWAL_REVERSAL',
  'INVESTMENT_PURCHASE',
  'INVESTMENT_SALE',
  'ROI_DISTRIBUTION',
  'REFERRAL_BONUS',
  'TRANSFER',
  'FEE',
  'ADMIN_ADJUSTMENT',
  'DEV_CREDIT',
  'PROPERTY_RENT_DISTRIBUTION',
  'LEGACY_UNKNOWN'
);

CREATE TYPE "LedgerOperationStatus" AS ENUM (
  'POSTED',
  'REVERSED',
  'VOIDED',
  'RECONCILIATION_REQUIRED'
);

CREATE TABLE "LedgerOperation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "LedgerOperationType" NOT NULL,
    "status" "LedgerOperationStatus" NOT NULL DEFAULT 'POSTED',
    "currency" "Currency" NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "legFingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerOperation_reference_key" ON "LedgerOperation"("reference");

CREATE INDEX "LedgerOperation_type_createdAt_idx" ON "LedgerOperation"("type", "createdAt");
CREATE INDEX "LedgerOperation_status_idx" ON "LedgerOperation"("status");
CREATE INDEX "LedgerOperation_createdAt_idx" ON "LedgerOperation"("createdAt");

ALTER TABLE "Transaction" ADD COLUMN "ledgerOperationId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "ledgerLegIndex" INTEGER;

CREATE INDEX "Transaction_ledgerOperationId_idx" ON "Transaction"("ledgerOperationId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ledgerOperationId_fkey"
  FOREIGN KEY ("ledgerOperationId") REFERENCES "LedgerOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Transaction_ledgerOperationId_ledgerLegIndex_key"
  ON "Transaction"("ledgerOperationId", "ledgerLegIndex")
  WHERE "ledgerOperationId" IS NOT NULL AND "ledgerLegIndex" IS NOT NULL;
