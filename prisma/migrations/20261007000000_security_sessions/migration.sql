CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedUntil" TIMESTAMP(3)
);
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE TABLE "auth_rate_limits" (
  "id" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "auth_rate_limits_resetAt_idx" ON "auth_rate_limits"("resetAt");
CREATE TABLE "operation_receipts" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "restaurant_orders" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
