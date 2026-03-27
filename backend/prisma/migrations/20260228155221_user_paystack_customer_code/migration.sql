-- AlterTable (must run after 20260228155220_init — User table exists)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackCustomerCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackCustomerCode_key" ON "User"("paystackCustomerCode");
