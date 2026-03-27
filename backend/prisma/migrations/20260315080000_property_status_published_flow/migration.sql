-- Add CLOSED to PropertyStatus enum (for sold-out / closed properties)
ALTER TYPE "PropertyStatus" ADD VALUE 'CLOSED';

-- Add publishedAt for when property became investable
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Migrate existing statuses to new model: UNDER_REVIEW/APPROVED -> PUBLISHED, FUNDED/EXITED -> CLOSED
UPDATE "Property"
SET "status" = 'PUBLISHED', "publishedAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" IN ('UNDER_REVIEW', 'APPROVED');

UPDATE "Property"
SET "status" = 'CLOSED'
WHERE "status" IN ('FUNDED', 'EXITED');

-- Create new enum with only DRAFT, PUBLISHED, CLOSED
CREATE TYPE "PropertyStatus_new" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- Switch column to new enum (all rows now use one of these three values)
ALTER TABLE "Property" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Property" ALTER COLUMN "status" TYPE "PropertyStatus_new"
  USING ("status"::text::"PropertyStatus_new");
ALTER TABLE "Property" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"PropertyStatus_new";

-- Drop old enum and rename new
DROP TYPE "PropertyStatus";
ALTER TYPE "PropertyStatus_new" RENAME TO "PropertyStatus";
