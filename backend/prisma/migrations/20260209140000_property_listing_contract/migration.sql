-- Property listing / investment display contract (additive, non-destructive).

CREATE TYPE "ListingType" AS ENUM ('FRACTIONAL_OWNERSHIP', 'LAND_ACQUISITION', 'OWN_A_HOME');
CREATE TYPE "PropertyYieldBasis" AS ENUM ('PROJECTED', 'HISTORICAL', 'UNSPECIFIED');
CREATE TYPE "TitleVerificationStatus" AS ENUM ('UNSPECIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "LegalReviewStatus" AS ENUM ('UNSPECIFIED', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Property" ADD COLUMN "listingType" "ListingType" NOT NULL DEFAULT 'FRACTIONAL_OWNERSHIP';
ALTER TABLE "Property" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Property" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Property" ADD COLUMN "state" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Property" ADD COLUMN "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Property" ADD COLUMN "developerName" TEXT;
ALTER TABLE "Property" ADD COLUMN "isListedPartnerDeveloper" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "yieldIsProjected" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Property" ADD COLUMN "yieldBasis" "PropertyYieldBasis" NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "Property" ADD COLUMN "termMonths" INTEGER;
ALTER TABLE "Property" ADD COLUMN "expectedReturnDisclosure" TEXT;
ALTER TABLE "Property" ADD COLUMN "riskDisclosure" TEXT;
ALTER TABLE "Property" ADD COLUMN "titleVerificationStatus" "TitleVerificationStatus" NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "Property" ADD COLUMN "legalReviewStatus" "LegalReviewStatus" NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "Property" ADD COLUMN "documentsAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "features" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Property" ADD COLUMN "terms" TEXT;

ALTER TABLE "Property" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

UPDATE "Property" SET "address" = TRIM("location") WHERE COALESCE(TRIM("address"), '') = '' AND COALESCE(TRIM("location"), '') <> '';

UPDATE "Property" SET "documentsAvailable" = true
WHERE EXISTS (SELECT 1 FROM "PropertyDocument" d WHERE d."propertyId" = "Property"."id");
