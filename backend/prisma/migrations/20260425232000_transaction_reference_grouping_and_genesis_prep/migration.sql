-- Double-entry prep:
-- 1) Remove unique reference constraint (reference now groups multiple legs)
-- 2) Enforce non-null groupId and align historical rows to reference

DROP INDEX IF EXISTS "Transaction_reference_key";

UPDATE "Transaction"
SET "groupId" = "reference"
WHERE "groupId" IS NULL;

ALTER TABLE "Transaction"
ALTER COLUMN "groupId" SET NOT NULL;

