-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_groupId_idx" ON "Transaction"("groupId");

-- CreateTable
CREATE TABLE "InvestmentReturn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "fee" DECIMAL(19,4) NOT NULL,
    "netAmount" DECIMAL(19,4) NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentReturn_investmentId_period_key" ON "InvestmentReturn"("investmentId", "period");

-- CreateIndex
CREATE INDEX "InvestmentReturn_userId_idx" ON "InvestmentReturn"("userId");

-- CreateIndex
CREATE INDEX "InvestmentReturn_propertyId_period_idx" ON "InvestmentReturn"("propertyId", "period");

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
