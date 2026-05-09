-- Issue 6: production-safe virtual account lifecycle + verified deposit event visibility.

CREATE TYPE "VirtualAccountProvider" AS ENUM ('FLUTTERWAVE');
CREATE TYPE "VirtualAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'SUSPENDED', 'CLOSED', 'REQUIRES_RETRY');
CREATE TYPE "VirtualAccountDepositStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'CREDITED', 'UNMATCHED', 'FAILED', 'IGNORED');

ALTER TABLE "VirtualAccount"
  ALTER COLUMN "provider" TYPE "VirtualAccountProvider"
    USING (
      CASE
        WHEN UPPER(COALESCE("provider", '')) = 'FLUTTERWAVE' THEN 'FLUTTERWAVE'::"VirtualAccountProvider"
        ELSE 'FLUTTERWAVE'::"VirtualAccountProvider"
      END
    ),
  ALTER COLUMN "accountNumber" DROP NOT NULL,
  ALTER COLUMN "accountName" DROP NOT NULL,
  ALTER COLUMN "bankName" DROP NOT NULL;

ALTER TABLE "VirtualAccount"
  ADD COLUMN "bankCode" TEXT,
  ADD COLUMN "providerAccountId" TEXT,
  ADD COLUMN "providerReference" TEXT,
  ADD COLUMN "status" "VirtualAccountStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "lastProviderResponse" JSONB,
  ADD COLUMN "provisionedAt" TIMESTAMP(3),
  ADD COLUMN "lastProvisionAttemptAt" TIMESTAMP(3),
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "VirtualAccount_userId_currency_idx";
CREATE UNIQUE INDEX "VirtualAccount_userId_provider_currency_key"
  ON "VirtualAccount"("userId", "provider", "currency");
CREATE UNIQUE INDEX "VirtualAccount_providerAccountId_key"
  ON "VirtualAccount"("providerAccountId");
CREATE UNIQUE INDEX "VirtualAccount_providerReference_key"
  ON "VirtualAccount"("providerReference");
CREATE INDEX "VirtualAccount_userId_status_idx" ON "VirtualAccount"("userId", "status");
CREATE INDEX "VirtualAccount_accountNumber_idx" ON "VirtualAccount"("accountNumber");

CREATE TABLE "VirtualAccountDepositEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "virtualAccountId" TEXT,
  "provider" "VirtualAccountProvider" NOT NULL,
  "providerTransactionId" TEXT,
  "providerReference" TEXT,
  "accountNumber" TEXT,
  "amount" DECIMAL(19,4),
  "currency" "Currency",
  "status" "VirtualAccountDepositStatus" NOT NULL DEFAULT 'RECEIVED',
  "reason" TEXT,
  "payload" JSONB,
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VirtualAccountDepositEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VirtualAccountDepositEvent_providerTransactionId_key"
  ON "VirtualAccountDepositEvent"("providerTransactionId");
CREATE INDEX "VirtualAccountDepositEvent_status_createdAt_idx"
  ON "VirtualAccountDepositEvent"("status", "createdAt");
CREATE INDEX "VirtualAccountDepositEvent_providerReference_idx"
  ON "VirtualAccountDepositEvent"("providerReference");
CREATE INDEX "VirtualAccountDepositEvent_accountNumber_idx"
  ON "VirtualAccountDepositEvent"("accountNumber");

ALTER TABLE "VirtualAccountDepositEvent"
  ADD CONSTRAINT "VirtualAccountDepositEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VirtualAccountDepositEvent"
  ADD CONSTRAINT "VirtualAccountDepositEvent_virtualAccountId_fkey"
  FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
