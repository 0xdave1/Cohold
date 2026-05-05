-- Issue 5: KYC compliance — identity hashing/encryption fields, audit trail, document slot metadata.
-- Follow-up (gated, explicit): backfill legacy `User.bvn` / `governmentIdNumber` into `identityEncrypted`+`identityHash`, then NULL deprecated columns.

CREATE TYPE "IdentityType" AS ENUM ('BVN', 'NIN');

CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'MANUAL_REVIEW');

CREATE TYPE "KycDocumentObjectStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED', 'QUARANTINED');

DROP INDEX IF EXISTS "User_bvn_key";

ALTER TABLE "KycVerification" ADD COLUMN     "identityType" "IdentityType",
ADD COLUMN     "identityEncrypted" TEXT,
ADD COLUMN     "identityHash" TEXT,
ADD COLUMN     "identityLast4" TEXT,
ADD COLUMN     "identityProviderReference" TEXT,
ADD COLUMN     "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "identityVerificationStatus" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "kycDocumentSlots" JSONB,
ADD COLUMN     "identityDataRetentionUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX "KycVerification_identityHash_key" ON "KycVerification"("identityHash");

CREATE TABLE "KycAuditLog" (
    "id" TEXT NOT NULL,
    "kycVerificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "action" TEXT NOT NULL,
    "previousKycStatus" "KycStatus" NOT NULL,
    "nextKycStatus" "KycStatus" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KycAuditLog_userId_createdAt_idx" ON "KycAuditLog"("userId", "createdAt");

CREATE INDEX "KycAuditLog_kycVerificationId_createdAt_idx" ON "KycAuditLog"("kycVerificationId", "createdAt");

CREATE INDEX "KycAuditLog_actorAdminId_createdAt_idx" ON "KycAuditLog"("actorAdminId", "createdAt");

ALTER TABLE "KycAuditLog" ADD CONSTRAINT "KycAuditLog_kycVerificationId_fkey" FOREIGN KEY ("kycVerificationId") REFERENCES "KycVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
