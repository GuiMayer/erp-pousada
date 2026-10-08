ALTER TABLE "cash_closes" ADD COLUMN "responsibleUserId" TEXT;
UPDATE "cash_closes" c SET "responsibleUserId" = u.id FROM "users" u WHERE c.operator = u.username;
