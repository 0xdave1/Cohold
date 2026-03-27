-- AlterTable: Add accountName with default for existing rows
ALTER TABLE "VirtualAccount" ADD COLUMN "accountName" TEXT;
UPDATE "VirtualAccount" SET "accountName" = COALESCE("bankName", 'Account') WHERE "accountName" IS NULL;
ALTER TABLE "VirtualAccount" ALTER COLUMN "accountName" SET NOT NULL;
