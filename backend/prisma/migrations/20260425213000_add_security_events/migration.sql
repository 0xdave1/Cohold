CREATE TYPE "SecurityEventType" AS ENUM (
  'LOGIN_SUCCESS',
  'LOGOUT',
  'LOGOUT_ALL',
  'REFRESH_REUSE',
  'PASSWORD_RESET',
  'SESSION_REVOKED',
  'USER_AGENT_MISMATCH'
);

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "type" "SecurityEventType" NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

ALTER TABLE "SecurityEvent"
ADD CONSTRAINT "SecurityEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
