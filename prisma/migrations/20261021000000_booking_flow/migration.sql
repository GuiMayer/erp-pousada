ALTER TABLE "reservations"
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancellationFinancialReason" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancellationReceivedValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundedValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "retainedValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "stays" ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "arrivalReason" TEXT;
