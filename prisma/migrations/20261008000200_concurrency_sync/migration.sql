-- Database-wide version increments cover business commands, imports and workers.
CREATE FUNCTION erp_bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_ARGV[0] = 'version' THEN
    IF NEW.version = OLD.version THEN NEW.version := OLD.version + 1; END IF;
  ELSIF (to_jsonb(NEW) - 'lastLogin' - 'recordVersion') IS DISTINCT FROM (to_jsonb(OLD) - 'lastLogin' - 'recordVersion') THEN
    IF NEW."recordVersion" = OLD."recordVersion" THEN NEW."recordVersion" := OLD."recordVersion" + 1; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION erp_sync_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('erp_sync', TG_ARGV[0]);
  RETURN NULL;
END $$;

CREATE TRIGGER erp_version BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "system_settings" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "rooms" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "guest_profiles" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "reservations" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "expense_categories" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "suppliers" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "customers" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "expenses" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "bank_accounts" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "cost_centers" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "accounts_receivable" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "budgets" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "recurring_transactions" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "product_categories" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "pos_products" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "restaurant_tables" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "restaurant_orders" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('version');
CREATE TRIGGER erp_version BEFORE UPDATE ON "stock_items" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "recipes" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_version BEFORE UPDATE ON "employees" FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "rooms" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('rooms');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "guest_profiles" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('guests');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "reservations" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('reservations');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "room_consumptions" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('consumptions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "room_consumption_items" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('consumptions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "expense_categories" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('categories');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "suppliers" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('suppliers');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "customers" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('customers');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "expenses" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('expenses');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "expense_installments" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('expenses');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "bank_accounts" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('bankAccounts');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "cost_centers" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('costCenters');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "transactions" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('transactions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "cash_closes" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('cashCloses');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "accounts_receivable" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('accountsReceivable');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "account_receivable_installments" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('accountsReceivable');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "bank_transfers" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('bankTransfers');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "budgets" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('budgets');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "budget_categories" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('budgets');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "recurring_transactions" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('recurringTransactions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "product_categories" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('productCategories');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "pos_products" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('posProducts');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "pos_sales" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('posSales');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "pos_sale_items" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('posSales');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "restaurant_tables" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('restaurantTables');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "restaurant_orders" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('restaurantOrders');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "restaurant_order_items" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('restaurantOrders');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "stock_items" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('stockItems');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "stock_movements" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('stockMovements');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "recipes" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('recipes');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "recipe_ingredients" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('recipes');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "productions" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('productions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "employees" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('employees');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "employee_consumptions" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('employeeConsumptions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "employee_consumption_items" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('employeeConsumptions');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "users" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('users');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "system_settings" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('systemSettings');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "audit_entries" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('auditLog');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON "user_notifications" FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('notifications');
CREATE FUNCTION erp_touch_expense_installments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE "expenses" SET "recordVersion" = "recordVersion" + 1 WHERE id = OLD."expenseId"; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."expenseId" IS DISTINCT FROM OLD."expenseId") THEN UPDATE "expenses" SET "recordVersion" = "recordVersion" + 1 WHERE id = NEW."expenseId"; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER erp_touch AFTER INSERT OR UPDATE OR DELETE ON "expense_installments" FOR EACH ROW EXECUTE FUNCTION erp_touch_expense_installments();
CREATE FUNCTION erp_touch_account_receivable_installments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE "accounts_receivable" SET "recordVersion" = "recordVersion" + 1 WHERE id = OLD."accountReceivableId"; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."accountReceivableId" IS DISTINCT FROM OLD."accountReceivableId") THEN UPDATE "accounts_receivable" SET "recordVersion" = "recordVersion" + 1 WHERE id = NEW."accountReceivableId"; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER erp_touch AFTER INSERT OR UPDATE OR DELETE ON "account_receivable_installments" FOR EACH ROW EXECUTE FUNCTION erp_touch_account_receivable_installments();
CREATE FUNCTION erp_touch_budget_categories() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE "budgets" SET "recordVersion" = "recordVersion" + 1 WHERE id = OLD."budgetId"; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."budgetId" IS DISTINCT FROM OLD."budgetId") THEN UPDATE "budgets" SET "recordVersion" = "recordVersion" + 1 WHERE id = NEW."budgetId"; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER erp_touch AFTER INSERT OR UPDATE OR DELETE ON "budget_categories" FOR EACH ROW EXECUTE FUNCTION erp_touch_budget_categories();
CREATE FUNCTION erp_touch_recipe_ingredients() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE "recipes" SET "recordVersion" = "recordVersion" + 1 WHERE id = OLD."recipeId"; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."recipeId" IS DISTINCT FROM OLD."recipeId") THEN UPDATE "recipes" SET "recordVersion" = "recordVersion" + 1 WHERE id = NEW."recipeId"; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER erp_touch AFTER INSERT OR UPDATE OR DELETE ON "recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION erp_touch_recipe_ingredients();
CREATE FUNCTION erp_touch_restaurant_order_items() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN UPDATE "restaurant_orders" SET "version" = "version" + 1 WHERE id = OLD."orderId"; END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."orderId" IS DISTINCT FROM OLD."orderId") THEN UPDATE "restaurant_orders" SET "version" = "version" + 1 WHERE id = NEW."orderId"; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER erp_touch AFTER INSERT OR UPDATE OR DELETE ON "restaurant_order_items" FOR EACH ROW EXECUTE FUNCTION erp_touch_restaurant_order_items();
CREATE UNIQUE INDEX one_active_order_per_table ON restaurant_orders("tableId") WHERE status = 'aberta';

-- A restore takes the exclusive form of this lock; normal mutations share it.
CREATE FUNCTION erp_write_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(74192026);
  RETURN NULL;
END $$;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('CREATE TRIGGER erp_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION erp_write_guard()', t.tablename);
  END LOOP;
END $$;
