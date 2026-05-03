-- Withdrawal lifecycle: atomic payout claim (INITIATING) and ambiguous-provider state (RECONCILIATION_REQUIRED).
ALTER TYPE "WithdrawalStatus" ADD VALUE 'INITIATING';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'RECONCILIATION_REQUIRED';

ALTER TABLE "Withdrawal" ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerLastCheckedAt" TIMESTAMP(3);
