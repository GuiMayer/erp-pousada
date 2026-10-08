ALTER TABLE reservations ADD COLUMN "originalValue" DECIMAL(12,2), ADD COLUMN "paidValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE reservations SET "originalValue" = "totalValue";
ALTER TABLE transactions ADD COLUMN "cashSessionId" TEXT;
CREATE INDEX transactions_cash_session_idx ON transactions("cashSessionId");
ALTER TABLE cash_closes ADD COLUMN status TEXT NOT NULL DEFAULT 'fechado', ADD COLUMN "openedAt" TIMESTAMP(3), ADD COLUMN "closedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX one_open_cash_session ON cash_closes(status) WHERE status = 'aberto';

ALTER TABLE guest_profiles ADD COLUMN "creditValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN "cancellationFee" DECIMAL(12,2) NOT NULL DEFAULT 0;
