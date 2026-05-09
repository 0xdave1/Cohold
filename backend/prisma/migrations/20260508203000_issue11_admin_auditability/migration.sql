-- Issue 11: admin auditability hardening (additive migration)
ALTER TABLE "AdminActivityLog"
  ADD COLUMN "actorAdminId" TEXT,
  ADD COLUMN "actorRole" "AdminRole",
  ADD COLUMN "targetType" TEXT,
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "previousValue" JSONB,
  ADD COLUMN "nextValue" JSONB,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT;

CREATE INDEX "AdminActivityLog_actorAdminId_createdAt_idx"
  ON "AdminActivityLog"("actorAdminId", "createdAt");

CREATE INDEX "AdminActivityLog_action_createdAt_idx"
  ON "AdminActivityLog"("action", "createdAt");

CREATE INDEX "AdminActivityLog_targetType_targetId_createdAt_idx"
  ON "AdminActivityLog"("targetType", "targetId", "createdAt");
