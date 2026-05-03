-- Persistent flag when provider SUCCESS conflicts with prior local failure + reversal.
ALTER TABLE "Withdrawal" ADD COLUMN "reconciliationConflict" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Withdrawal" ADD COLUMN "reconciliationConflictReason" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "reconciliationConflictAt" TIMESTAMP(3);
