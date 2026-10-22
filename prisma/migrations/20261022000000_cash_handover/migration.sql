ALTER TABLE cash_closes
  ADD COLUMN "previousSessionId" TEXT,
  ADD COLUMN "openingReason" TEXT,
  ADD COLUMN "retainedValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "withdrawnValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "withdrawalAccountId" TEXT,
  ADD COLUMN "closingReason" TEXT,
  ADD COLUMN "closedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewNote" TEXT;

ALTER TABLE cash_closes ADD CONSTRAINT cash_handover_nonnegative CHECK ("retainedValue" >= 0 AND "withdrawnValue" >= 0);
