-- Issue 8: realized income and distribution batch integrity (additive)

CREATE TYPE "PropertyIncomeEventType" AS ENUM ('RENT', 'PLATFORM_SUBSIDY', 'OTHER_INCOME', 'ADJUSTMENT');
CREATE TYPE "PropertyIncomeEventStatus" AS ENUM ('PENDING', 'APPROVED', 'POSTED', 'REJECTED', 'REVERSED');
CREATE TYPE "DistributionBatchStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "DistributionBatchItemStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'SKIPPED', 'REVERSED');

CREATE TABLE "PropertyIncomeEvent" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" "Currency" NOT NULL,
  "type" "PropertyIncomeEventType" NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" "PropertyIncomeEventStatus" NOT NULL DEFAULT 'PENDING',
  "sourceReference" TEXT,
  "ledgerOperationId" TEXT,
  "metadata" JSONB,
  "createdByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyIncomeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributionBatch" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "incomeEventId" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "currency" "Currency" NOT NULL,
  "grossIncome" DECIMAL(19,4) NOT NULL,
  "expenses" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "platformFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "netDistributable" DECIMAL(19,4) NOT NULL,
  "status" "DistributionBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "reference" TEXT NOT NULL,
  "createdByAdminId" TEXT NOT NULL,
  "approvedByAdminId" TEXT,
  "processedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistributionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributionBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "investmentId" TEXT,
  "shares" DECIMAL(24,8) NOT NULL,
  "ownershipPercent" DECIMAL(10,6) NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" "Currency" NOT NULL,
  "status" "DistributionBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "ledgerOperationId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistributionBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DistributionBatch_reference_key" ON "DistributionBatch"("reference");
CREATE INDEX "PropertyIncomeEvent_propertyId_status_createdAt_idx" ON "PropertyIncomeEvent"("propertyId","status","createdAt");
CREATE INDEX "PropertyIncomeEvent_sourceReference_idx" ON "PropertyIncomeEvent"("sourceReference");
CREATE INDEX "DistributionBatch_propertyId_status_createdAt_idx" ON "DistributionBatch"("propertyId","status","createdAt");
CREATE INDEX "DistributionBatch_incomeEventId_idx" ON "DistributionBatch"("incomeEventId");
CREATE INDEX "DistributionBatchItem_batchId_status_idx" ON "DistributionBatchItem"("batchId","status");
CREATE INDEX "DistributionBatchItem_userId_createdAt_idx" ON "DistributionBatchItem"("userId","createdAt");
CREATE INDEX "DistributionBatchItem_investmentId_idx" ON "DistributionBatchItem"("investmentId");

ALTER TABLE "PropertyIncomeEvent" ADD CONSTRAINT "PropertyIncomeEvent_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyIncomeEvent" ADD CONSTRAINT "PropertyIncomeEvent_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyIncomeEvent" ADD CONSTRAINT "PropertyIncomeEvent_approvedByAdminId_fkey"
  FOREIGN KEY ("approvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributionBatch" ADD CONSTRAINT "DistributionBatch_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributionBatch" ADD CONSTRAINT "DistributionBatch_incomeEventId_fkey"
  FOREIGN KEY ("incomeEventId") REFERENCES "PropertyIncomeEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributionBatch" ADD CONSTRAINT "DistributionBatch_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributionBatch" ADD CONSTRAINT "DistributionBatch_approvedByAdminId_fkey"
  FOREIGN KEY ("approvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DistributionBatchItem" ADD CONSTRAINT "DistributionBatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "DistributionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributionBatchItem" ADD CONSTRAINT "DistributionBatchItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DistributionBatchItem" ADD CONSTRAINT "DistributionBatchItem_investmentId_fkey"
  FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
