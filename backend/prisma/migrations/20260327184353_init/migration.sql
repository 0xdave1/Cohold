-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('NGN', 'USD', 'GBP', 'EUR');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('DATA_UPLOADER', 'APPROVER', 'SUPER_ADMIN', 'COMPLIANCE_ADMIN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('WALLET_TOP_UP', 'WALLET_WITHDRAWAL', 'WALLET_SWAP', 'P2P_TRANSFER', 'INVESTMENT', 'BUY', 'SELL', 'ROI', 'PROPERTY_FUNDING', 'DISTRIBUTION', 'FEE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "phoneCountryCode" TEXT,
    "nationality" TEXT,
    "houseNumber" TEXT,
    "streetName" TEXT,
    "city" TEXT,
    "state" TEXT,
    "bvn" TEXT,
    "paystackCustomerCode" TEXT,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "onboardingCompletedAt" TIMESTAMP(3),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'DATA_UPLOADER',
    "fullName" TEXT,
    "phoneNumber" TEXT,
    "accountStatus" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT,
    "userId" TEXT,
    "reference" TEXT NOT NULL,
    "externalReference" TEXT,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "fee" DECIMAL(19,4),
    "netAmount" DECIMAL(19,4),
    "currency" "Currency" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "metadata" JSONB,
    "propertyId" TEXT,
    "investmentId" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'PUBLISHED',
    "totalValue" DECIMAL(24,8) NOT NULL,
    "sharePrice" DECIMAL(24,8) NOT NULL,
    "currency" "Currency" NOT NULL,
    "minInvestment" DECIMAL(19,4) NOT NULL,
    "currentRaised" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "sharesTotal" DECIMAL(24,8) NOT NULL,
    "sharesSold" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "annualYield" DECIMAL(12,8),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "shares" DECIMAL(24,8) NOT NULL,
    "sharePrice" DECIMAL(24,8) NOT NULL,
    "ownershipPercent" DECIMAL(10,6) NOT NULL,
    "totalReturns" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "governmentIdType" TEXT,
    "governmentIdNumber" TEXT,
    "documentKey" TEXT,
    "failureReason" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "platformFee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "executedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionPayout" (
    "id" TEXT NOT NULL,
    "distributionId" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaystackWebhookEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reference" TEXT,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaystackWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_bvn_key" ON "User"("bvn");

-- CreateIndex
CREATE UNIQUE INDEX "User_paystackCustomerCode_key" ON "User"("paystackCustomerCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Admin_accountStatus_idx" ON "Admin"("accountStatus");

-- CreateIndex
CREATE INDEX "Admin_email_idx" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Wallet_userId_currency_idx" ON "Wallet"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_walletId_idx" ON "Transaction"("walletId");

-- CreateIndex
CREATE INDEX "Transaction_reference_idx" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_groupId_idx" ON "Transaction"("groupId");

-- CreateIndex
CREATE INDEX "Transaction_externalReference_idx" ON "Transaction"("externalReference");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_investmentId_idx" ON "Transaction"("investmentId");

-- CreateIndex
CREATE INDEX "Property_status_createdAt_idx" ON "Property"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Investment_clientReference_key" ON "Investment"("clientReference");

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- CreateIndex
CREATE INDEX "Investment_propertyId_idx" ON "Investment"("propertyId");

-- CreateIndex
CREATE INDEX "Investment_userId_propertyId_idx" ON "Investment"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "InvestmentReturn_userId_idx" ON "InvestmentReturn"("userId");

-- CreateIndex
CREATE INDEX "InvestmentReturn_propertyId_period_idx" ON "InvestmentReturn"("propertyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentReturn_investmentId_period_key" ON "InvestmentReturn"("investmentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_userId_key" ON "KycVerification"("userId");

-- CreateIndex
CREATE INDEX "KycVerification_status_createdAt_idx" ON "KycVerification"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_accountNumber_key" ON "VirtualAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "VirtualAccount_userId_currency_idx" ON "VirtualAccount"("userId", "currency");

-- CreateIndex
CREATE INDEX "Distribution_propertyId_status_idx" ON "Distribution"("propertyId", "status");

-- CreateIndex
CREATE INDEX "DistributionPayout_distributionId_idx" ON "DistributionPayout"("distributionId");

-- CreateIndex
CREATE INDEX "DistributionPayout_investmentId_idx" ON "DistributionPayout"("investmentId");

-- CreateIndex
CREATE INDEX "AdminActivityLog_adminId_createdAt_idx" ON "AdminActivityLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_reference_idx" ON "PaystackWebhookEvent"("reference");

-- CreateIndex
CREATE INDEX "PaystackWebhookEvent_event_createdAt_idx" ON "PaystackWebhookEvent"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReturn" ADD CONSTRAINT "InvestmentReturn_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionPayout" ADD CONSTRAINT "DistributionPayout_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionPayout" ADD CONSTRAINT "DistributionPayout_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
