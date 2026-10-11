CREATE TABLE "initial_import_batches" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'preview',
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "initial_import_batches_kind_contentHash_key" ON "initial_import_batches"("kind", "contentHash");
CREATE INDEX "initial_import_batches_expiresAt_idx" ON "initial_import_batches"("expiresAt");
CREATE INDEX "stay_occupants_customerId_idx" ON "stay_occupants"("customerId");
