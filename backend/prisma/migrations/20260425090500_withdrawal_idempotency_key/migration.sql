-- Add per-user idempotency support for withdrawal submissions.
ALTER TABLE "Withdrawal"
ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT '';

-- Existing rows are legacy (pre-idempotency). Assign deterministic unique keys.
UPDATE "Withdrawal"
SET "idempotencyKey" = CONCAT('legacy-', "id")
WHERE "idempotencyKey" = '';

ALTER TABLE "Withdrawal"
ALTER COLUMN "idempotencyKey" DROP DEFAULT;

CREATE UNIQUE INDEX "Withdrawal_userId_idempotencyKey_key"
ON "Withdrawal"("userId", "idempotencyKey");
