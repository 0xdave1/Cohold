-- CreateEnum
CREATE TYPE "WalletFundingPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REQUIRES_RECONCILIATION');

-- CreateTable
CREATE TABLE "WalletFundingPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "internalReference" TEXT NOT NULL,
    "amountNaira" DECIMAL(19,4) NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "status" "WalletFundingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WalletFundingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletFundingPayment_internalReference_key" ON "WalletFundingPayment"("internalReference");

-- CreateIndex
CREATE INDEX "WalletFundingPayment_userId_status_idx" ON "WalletFundingPayment"("userId", "status");

-- CreateIndex
CREATE INDEX "WalletFundingPayment_status_createdAt_idx" ON "WalletFundingPayment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletFundingPayment" ADD CONSTRAINT "WalletFundingPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
