-- Hotel
CREATE TABLE "rooms" (
    "id" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "guest" TEXT,
    "guestCpf" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "checkOutTime" TEXT,
    "blockReason" TEXT,
    "blockEndDate" TIMESTAMP(3),
    "blockResponsible" TEXT,
    "timeline" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guest_profiles" (
    "cpf" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalStays" INTEGER NOT NULL DEFAULT 0,
    "avgTicket" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "noShows" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("cpf")
);

CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "cancelTreatment" TEXT,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_consumptions" (
    "id" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    CONSTRAINT "room_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_consumption_items" (
    "id" TEXT NOT NULL,
    "consumptionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "room_consumption_items_pkey" PRIMARY KEY ("id")
);

-- Financeiro
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplierId" TEXT,
    "value" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paymentDate" TIMESTAMP(3),
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_installments" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paymentDate" TIMESTAMP(3),
    CONSTRAINT "expense_installments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bank" TEXT,
    "agency" TEXT,
    "accountNumber" TEXT,
    "initialBalance" DECIMAL(12,2) NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "category" TEXT,
    "paymentMethod" TEXT,
    "responsible" TEXT,
    "notes" TEXT,
    "accountId" TEXT,
    "costCenterId" TEXT,
    "taxAmount" DECIMAL(12,2),
    "taxType" TEXT,
    "grossAmount" DECIMAL(12,2),
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_closes" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "operator" TEXT NOT NULL,
    "physicalValue" DECIMAL(12,2) NOT NULL,
    "expectedValue" DECIMAL(12,2) NOT NULL,
    "divergence" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts_receivable" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "category" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account_receivable_installments" (
    "id" TEXT NOT NULL,
    "accountReceivableId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    CONSTRAINT "account_receivable_installments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_transfers" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "status" TEXT NOT NULL,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_categories" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "plannedAmount" DECIMAL(12,2) NOT NULL,
    "spentAmount" DECIMAL(12,2) NOT NULL,
    "variance" DECIMAL(12,2) NOT NULL,
    "variancePercent" DECIMAL(8,2) NOT NULL,
    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurring_transactions" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "accountId" TEXT,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastGenerated" TIMESTAMP(3),
    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- POS, restaurante, estoque e funcionarios
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isRestaurant" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "barcode" TEXT,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "pos_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_sales" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "change" DECIMAL(12,2) NOT NULL,
    "customer" TEXT,
    "operator" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cancelReason" TEXT,
    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "pos_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_tables" (
    "id" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "currentOrderId" TEXT,
    "openedAt" TIMESTAMP(3),
    "roomId" INTEGER,
    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_orders" (
    "id" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "tableNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "amountPaid" DECIMAL(12,2),
    "change" DECIMAL(12,2),
    "customer" TEXT,
    "operator" TEXT NOT NULL,
    "cancelReason" TEXT,
    CONSTRAINT "restaurant_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "restaurant_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "currentStock" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "minimumStock" DECIMAL(12,3) NOT NULL,
    "maximumStock" DECIMAL(12,3) NOT NULL,
    "averageCost" DECIMAL(12,2) NOT NULL,
    "lastPurchasePrice" DECIMAL(12,2) NOT NULL,
    "lastPurchaseDate" TIMESTAMP(3),
    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "cost" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "registeredBy" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "expectedYield" DECIMAL(12,3) NOT NULL,
    "yieldUnit" TEXT NOT NULL,
    "preparationTime" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "productions" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeName" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(12,3) NOT NULL,
    "producedQuantity" DECIMAL(12,3) NOT NULL,
    "yield" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "producedBy" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "photo" TEXT,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "consumptionLimit" DECIMAL(12,2) NOT NULL,
    "mealBenefit" JSONB NOT NULL,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_consumptions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "registeredBy" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "employee_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_consumption_items" (
    "id" TEXT NOT NULL,
    "consumptionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "employee_consumption_items_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "rooms_number_key" ON "rooms"("number");
CREATE UNIQUE INDEX "room_consumptions_roomId_key" ON "room_consumptions"("roomId");
CREATE UNIQUE INDEX "expense_categories_label_key" ON "expense_categories"("label");
CREATE UNIQUE INDEX "restaurant_tables_number_key" ON "restaurant_tables"("number");
CREATE UNIQUE INDEX "stock_items_productId_key" ON "stock_items"("productId");
CREATE UNIQUE INDEX "employees_cpf_key" ON "employees"("cpf");

-- Indexes
CREATE INDEX "rooms_status_idx" ON "rooms"("status");
CREATE INDEX "reservations_roomId_checkIn_checkOut_status_idx" ON "reservations"("roomId", "checkIn", "checkOut", "status");
CREATE INDEX "reservations_cpf_idx" ON "reservations"("cpf");
CREATE INDEX "room_consumption_items_consumptionId_idx" ON "room_consumption_items"("consumptionId");
CREATE INDEX "suppliers_active_idx" ON "suppliers"("active");
CREATE INDEX "customers_cpfCnpj_idx" ON "customers"("cpfCnpj");
CREATE INDEX "customers_active_idx" ON "customers"("active");
CREATE INDEX "expenses_dueDate_paid_idx" ON "expenses"("dueDate", "paid");
CREATE INDEX "expenses_supplierId_idx" ON "expenses"("supplierId");
CREATE INDEX "expense_installments_expenseId_idx" ON "expense_installments"("expenseId");
CREATE INDEX "bank_accounts_active_idx" ON "bank_accounts"("active");
CREATE INDEX "cost_centers_active_idx" ON "cost_centers"("active");
CREATE INDEX "transactions_date_type_idx" ON "transactions"("date", "type");
CREATE INDEX "transactions_refId_idx" ON "transactions"("refId");
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");
CREATE INDEX "transactions_costCenterId_idx" ON "transactions"("costCenterId");
CREATE INDEX "cash_closes_date_idx" ON "cash_closes"("date");
CREATE INDEX "accounts_receivable_customerId_idx" ON "accounts_receivable"("customerId");
CREATE INDEX "accounts_receivable_dueDate_status_idx" ON "accounts_receivable"("dueDate", "status");
CREATE INDEX "account_receivable_installments_accountReceivableId_idx" ON "account_receivable_installments"("accountReceivableId");
CREATE INDEX "bank_transfers_date_idx" ON "bank_transfers"("date");
CREATE INDEX "bank_transfers_fromAccountId_idx" ON "bank_transfers"("fromAccountId");
CREATE INDEX "bank_transfers_toAccountId_idx" ON "bank_transfers"("toAccountId");
CREATE INDEX "budgets_year_month_idx" ON "budgets"("year", "month");
CREATE INDEX "budget_categories_budgetId_idx" ON "budget_categories"("budgetId");
CREATE INDEX "recurring_transactions_active_idx" ON "recurring_transactions"("active");
CREATE INDEX "recurring_transactions_accountId_idx" ON "recurring_transactions"("accountId");
CREATE INDEX "product_categories_active_isRestaurant_idx" ON "product_categories"("active", "isRestaurant");
CREATE INDEX "pos_products_categoryId_idx" ON "pos_products"("categoryId");
CREATE INDEX "pos_products_trackStock_idx" ON "pos_products"("trackStock");
CREATE INDEX "pos_sales_date_status_idx" ON "pos_sales"("date", "status");
CREATE INDEX "pos_sale_items_saleId_idx" ON "pos_sale_items"("saleId");
CREATE INDEX "pos_sale_items_productId_idx" ON "pos_sale_items"("productId");
CREATE INDEX "restaurant_tables_status_idx" ON "restaurant_tables"("status");
CREATE INDEX "restaurant_orders_tableId_status_idx" ON "restaurant_orders"("tableId", "status");
CREATE INDEX "restaurant_orders_openedAt_idx" ON "restaurant_orders"("openedAt");
CREATE INDEX "restaurant_order_items_orderId_idx" ON "restaurant_order_items"("orderId");
CREATE INDEX "restaurant_order_items_productId_idx" ON "restaurant_order_items"("productId");
CREATE INDEX "stock_movements_productId_timestamp_idx" ON "stock_movements"("productId", "timestamp");
CREATE INDEX "recipes_active_idx" ON "recipes"("active");
CREATE INDEX "recipe_ingredients_recipeId_idx" ON "recipe_ingredients"("recipeId");
CREATE INDEX "recipe_ingredients_productId_idx" ON "recipe_ingredients"("productId");
CREATE INDEX "productions_recipeId_timestamp_idx" ON "productions"("recipeId", "timestamp");
CREATE INDEX "employees_active_idx" ON "employees"("active");
CREATE INDEX "employee_consumptions_employeeId_timestamp_idx" ON "employee_consumptions"("employeeId", "timestamp");
CREATE INDEX "employee_consumption_items_consumptionId_idx" ON "employee_consumption_items"("consumptionId");
CREATE INDEX "employee_consumption_items_productId_idx" ON "employee_consumption_items"("productId");

-- Foreign keys
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cpf_fkey" FOREIGN KEY ("cpf") REFERENCES "guest_profiles"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_consumptions" ADD CONSTRAINT "room_consumptions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_consumption_items" ADD CONSTRAINT "room_consumption_items_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "room_consumptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_installments" ADD CONSTRAINT "expense_installments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_receivable_installments" ADD CONSTRAINT "account_receivable_installments_accountReceivableId_fkey" FOREIGN KEY ("accountReceivableId") REFERENCES "accounts_receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_products" ADD CONSTRAINT "pos_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sale_items" ADD CONSTRAINT "pos_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "restaurant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restaurant_order_items" ADD CONSTRAINT "restaurant_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "productions" ADD CONSTRAINT "productions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_consumptions" ADD CONSTRAINT "employee_consumptions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_consumption_items" ADD CONSTRAINT "employee_consumption_items_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "employee_consumptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_consumption_items" ADD CONSTRAINT "employee_consumption_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
