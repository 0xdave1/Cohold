-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'PROPERTY_FUNDING';

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");
