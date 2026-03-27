-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'COMPLIANCE_ADMIN';

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "accountStatus" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Admin_accountStatus_idx" ON "Admin"("accountStatus");
