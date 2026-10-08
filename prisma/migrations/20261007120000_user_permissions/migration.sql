ALTER TABLE "users" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "system_settings" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "rooms" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reservations" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "guest_profiles" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pos_products" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_categories" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "restaurant_tables" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "stock_items" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recipes" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bank_accounts" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "accounts_receivable" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "suppliers" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "expense_categories" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cost_centers" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "budgets" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recurring_transactions" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "accessProfile" TEXT, ADD COLUMN "permissionOverrides" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "users" SET "accessProfile" = CASE WHEN role = 'supervisor' THEN 'administrador' ELSE 'operador_legado' END;
UPDATE "auth_sessions" SET "approvedUntil" = NULL;
CREATE TABLE "operation_approvals" (
"id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "requesterId" TEXT NOT NULL,
"approverId" TEXT NOT NULL, "approverVersion" INTEGER NOT NULL, "requestId" TEXT NOT NULL,
"requestHash" TEXT NOT NULL, "permission" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
"usedAt" TIMESTAMP(3));
CREATE INDEX "operation_approvals_sessionId_requestId_idx" ON "operation_approvals"("sessionId", "requestId");
CREATE INDEX "operation_approvals_approverId_idx" ON "operation_approvals"("approverId");

CREATE FUNCTION bump_record_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."recordVersion" := OLD."recordVersion" + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "users_record_version" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "system_settings_record_version" BEFORE UPDATE ON "system_settings" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "rooms_record_version" BEFORE UPDATE ON "rooms" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "reservations_record_version" BEFORE UPDATE ON "reservations" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "guest_profiles_record_version" BEFORE UPDATE ON "guest_profiles" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "pos_products_record_version" BEFORE UPDATE ON "pos_products" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "product_categories_record_version" BEFORE UPDATE ON "product_categories" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "restaurant_tables_record_version" BEFORE UPDATE ON "restaurant_tables" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "stock_items_record_version" BEFORE UPDATE ON "stock_items" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "recipes_record_version" BEFORE UPDATE ON "recipes" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "expenses_record_version" BEFORE UPDATE ON "expenses" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "bank_accounts_record_version" BEFORE UPDATE ON "bank_accounts" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "accounts_receivable_record_version" BEFORE UPDATE ON "accounts_receivable" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "suppliers_record_version" BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "customers_record_version" BEFORE UPDATE ON "customers" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "expense_categories_record_version" BEFORE UPDATE ON "expense_categories" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "cost_centers_record_version" BEFORE UPDATE ON "cost_centers" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "budgets_record_version" BEFORE UPDATE ON "budgets" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "recurring_transactions_record_version" BEFORE UPDATE ON "recurring_transactions" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER "employees_record_version" BEFORE UPDATE ON "employees" FOR EACH ROW EXECUTE FUNCTION bump_record_version();
