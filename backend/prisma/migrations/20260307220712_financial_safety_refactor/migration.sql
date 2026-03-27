-- ============================================================
-- Migration: financial_safety_refactor
-- Adds: sharePrice on Property + Investment, ownershipPercent,
--        clientReference, PropertyImage, DistributionPayout,
--        soft delete, wallet unique constraint, composite indexes.
-- ============================================================

-- Step 1: Add sharePrice to Property with a temporary default.
-- Existing properties get sharePrice = totalValue / sharesTotal.
ALTER TABLE "Property" ADD COLUMN "sharePrice" DECIMAL(24,8);
ALTER TABLE "Property" ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Property"
SET "sharePrice" = CASE
  WHEN "sharesTotal" > 0 THEN "totalValue" / "sharesTotal"
  ELSE 0
END
WHERE "sharePrice" IS NULL;

ALTER TABLE "Property" ALTER COLUMN "sharePrice" SET NOT NULL;

-- Step 2: Add new columns to Investment with temporary defaults.
ALTER TABLE "Investment" ADD COLUMN "sharePrice" DECIMAL(24,8);
ALTER TABLE "Investment" ADD COLUMN "ownershipPercent" DECIMAL(10,6);
ALTER TABLE "Investment" ADD COLUMN "clientReference" TEXT;

-- Back-fill existing investments: sharePrice from property, ownershipPercent computed.
UPDATE "Investment" i
SET
  "sharePrice" = COALESCE(p."sharePrice", 0),
  "ownershipPercent" = CASE
    WHEN p."sharesTotal" > 0 THEN (i."shares" / p."sharesTotal") * 100
    ELSE 0
  END
FROM "Property" p
WHERE i."propertyId" = p."id"
  AND (i."sharePrice" IS NULL OR i."ownershipPercent" IS NULL);

-- Make NOT NULL after back-fill.
ALTER TABLE "Investment" ALTER COLUMN "sharePrice" SET NOT NULL;
ALTER TABLE "Investment" ALTER COLUMN "ownershipPercent" SET NOT NULL;

-- Step 3: Create PropertyImage table.
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- Step 4: Create DistributionPayout table.
CREATE TABLE "DistributionPayout" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistributionPayout_pkey" PRIMARY KEY ("id")
);

-- Step 5: Indexes.
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");
CREATE INDEX "DistributionPayout_distributionId_idx" ON "DistributionPayout"("distributionId");
CREATE INDEX "DistributionPayout_investmentId_idx" ON "DistributionPayout"("investmentId");
CREATE UNIQUE INDEX "Investment_clientReference_key" ON "Investment"("clientReference");
CREATE INDEX "Investment_userId_propertyId_idx" ON "Investment"("userId", "propertyId");
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- Wallet: enforce one wallet per currency per user.
-- If duplicates exist, this will fail — resolve duplicates first.
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");

-- Step 6: Foreign keys.
ALTER TABLE "PropertyImage"
  ADD CONSTRAINT "PropertyImage_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributionPayout"
  ADD CONSTRAINT "DistributionPayout_distributionId_fkey"
  FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributionPayout"
  ADD CONSTRAINT "DistributionPayout_investmentId_fkey"
  FOREIGN KEY ("investmentId") REFERENCES "Investment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
