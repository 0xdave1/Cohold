-- Make PropertyImage schema rollout-safe:
-- - restore legacy url column (nullable) for compatibility
-- - make storageKey nullable to avoid hard failures on existing rows during rollout

ALTER TABLE "PropertyImage" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "PropertyImage" ALTER COLUMN "storageKey" DROP NOT NULL;

