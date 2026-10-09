BEGIN;
-- Fail without changing anything when legacy documents collide. No name-based
-- merge or removal of balances/history is permitted by this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM customers GROUP BY upper(regexp_replace("cpfCnpj", '[./[:space:]-]', '', 'g')) HAVING count(*) > 1 AND upper(regexp_replace("cpfCnpj", '[./[:space:]-]', '', 'g')) <> '') THEN
    RAISE EXCEPTION 'S1: documentos duplicados em customers; revise os IDs antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE coalesce(cnpj, '') <> '' GROUP BY upper(regexp_replace(cnpj, '[./[:space:]-]', '', 'g')) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'S1: fornecedores com documento duplicado; revise sem apagar o histórico';
  END IF;
  IF EXISTS (SELECT 1 FROM guest_profiles GROUP BY upper(regexp_replace(cpf, '[./[:space:]-]', '', 'g')) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'S1: hóspedes com documento duplicado; revise os créditos e reservas';
  END IF;
  IF EXISTS (SELECT 1 FROM pos_products WHERE coalesce(trim(barcode), '') <> '' GROUP BY trim(barcode) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'S1: códigos de barras duplicados; revise o catálogo';
  END IF;
END $$;
ALTER TABLE customers ADD COLUMN roles JSONB NOT NULL DEFAULT '["payer"]';
UPDATE customers SET "cpfCnpj" = upper(regexp_replace("cpfCnpj", '[./[:space:]-]', '', 'g'));
CREATE UNIQUE INDEX customers_document_unique ON customers(upper(regexp_replace("cpfCnpj", '[./[:space:]-]', '', 'g'))) WHERE upper(regexp_replace("cpfCnpj", '[./[:space:]-]', '', 'g')) <> '';
CREATE FUNCTION erp_normalize_contact_document() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  NEW."cpfCnpj" := upper(regexp_replace(NEW."cpfCnpj", '[./[:space:]-]', '', 'g'));
  RETURN NEW;
END $$;
CREATE TRIGGER erp_contact_document BEFORE INSERT OR UPDATE OF "cpfCnpj" ON customers FOR EACH ROW EXECUTE FUNCTION erp_normalize_contact_document();
ALTER TABLE guest_profiles ADD COLUMN "customerId" TEXT, ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE suppliers ADD COLUMN "customerId" TEXT;
INSERT INTO customers (id, name, "cpfCnpj", roles, "updatedAt")
SELECT 'legacy-guest-' || md5(g.cpf), g.name, upper(regexp_replace(g.cpf, '[./[:space:]-]', '', 'g')), '["guest","payer"]', CURRENT_TIMESTAMP
FROM guest_profiles g WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c."cpfCnpj" = upper(regexp_replace(g.cpf, '[./[:space:]-]', '', 'g')));
UPDATE guest_profiles g SET "customerId" = c.id FROM customers c WHERE c."cpfCnpj" = upper(regexp_replace(g.cpf, '[./[:space:]-]', '', 'g'));
UPDATE customers SET roles = roles || '["guest"]' WHERE id IN (SELECT "customerId" FROM guest_profiles) AND NOT roles @> '["guest"]';
INSERT INTO customers (id, name, "cpfCnpj", email, phone, address, active, roles, "updatedAt")
SELECT 'legacy-supplier-' || md5(s.id), s.name, upper(regexp_replace(coalesce(s.cnpj, ''), '[./[:space:]-]', '', 'g')), s.email, s.phone, s.address, s.active, '["supplier"]', CURRENT_TIMESTAMP
FROM suppliers s WHERE coalesce(s.cnpj, '') = '' OR NOT EXISTS (SELECT 1 FROM customers c WHERE c."cpfCnpj" = upper(regexp_replace(s.cnpj, '[./[:space:]-]', '', 'g')));
UPDATE suppliers s SET "customerId" = c.id FROM customers c WHERE (coalesce(s.cnpj, '') <> '' AND c."cpfCnpj" = upper(regexp_replace(s.cnpj, '[./[:space:]-]', '', 'g'))) OR (coalesce(s.cnpj, '') = '' AND c.id = 'legacy-supplier-' || md5(s.id));
UPDATE customers SET roles = roles || '["supplier"]' WHERE id IN (SELECT "customerId" FROM suppliers) AND NOT roles @> '["supplier"]';
CREATE UNIQUE INDEX "guest_profiles_customerId_key" ON guest_profiles("customerId");
CREATE UNIQUE INDEX "suppliers_customerId_key" ON suppliers("customerId");
ALTER TABLE guest_profiles ADD CONSTRAINT "guest_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE suppliers ADD CONSTRAINT "suppliers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- Existing capacity/occupancy/price composition is unknown. Do not invent it.
ALTER TABLE rooms ADD COLUMN capacity INTEGER;
ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_check CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 100);
ALTER TABLE reservations ADD COLUMN "guestCount" INTEGER, ADD COLUMN "payerId" TEXT, ADD COLUMN "nightlyPrices" JSONB, ADD COLUMN "priceExceptionReason" TEXT;
ALTER TABLE reservations ADD CONSTRAINT "reservations_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE reservations ADD CONSTRAINT reservations_guest_count_check CHECK ("guestCount" IS NULL OR "guestCount" BETWEEN 1 AND 100);
ALTER TABLE pos_products ADD COLUMN active BOOLEAN NOT NULL DEFAULT true, ADD COLUMN unit TEXT NOT NULL DEFAULT 'un';
UPDATE pos_products p SET unit = s.unit FROM stock_items s WHERE s."productId" = p.id AND s.unit IN ('un', 'ml', 'l');
UPDATE pos_products SET barcode = nullif(trim(barcode), '');
CREATE UNIQUE INDEX pos_products_barcode_unique ON pos_products(barcode) WHERE barcode IS NOT NULL;
CREATE TABLE lodging_tariffs (
  id TEXT PRIMARY KEY, "recordVersion" INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL, "roomType" TEXT NOT NULL, "roomId" INTEGER,
  "minGuests" INTEGER NOT NULL, "maxGuests" INTEGER NOT NULL,
  "pricePerPerson" DECIMAL(12,2) NOT NULL, "validFrom" DATE NOT NULL, "validTo" DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "lodging_tariffs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES rooms(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT tariffs_occupancy_check CHECK ("minGuests" >= 1 AND "maxGuests" >= "minGuests" AND "maxGuests" <= 100),
  CONSTRAINT tariffs_price_check CHECK ("pricePerPerson" > 0),
  CONSTRAINT tariffs_period_check CHECK ("validTo" IS NULL OR "validTo" >= "validFrom")
);
CREATE INDEX "lodging_tariffs_roomType_roomId_active_validFrom_idx" ON lodging_tariffs("roomType", "roomId", active, "validFrom");
-- Protect even direct/concurrent writes without adding a new PostgreSQL extension.
CREATE FUNCTION erp_tariff_conflict() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(910092026);
  IF NEW.active AND EXISTS (SELECT 1 FROM lodging_tariffs t WHERE t.id <> NEW.id AND t.active
    AND ((NEW."roomId" IS NOT NULL AND t."roomId" = NEW."roomId") OR (NEW."roomId" IS NULL AND t."roomId" IS NULL AND t."roomType" = NEW."roomType"))
    AND t."minGuests" <= NEW."maxGuests" AND t."maxGuests" >= NEW."minGuests"
    AND t."validFrom" <= coalesce(NEW."validTo", '9999-12-31') AND coalesce(t."validTo", '9999-12-31') >= NEW."validFrom") THEN
    RAISE EXCEPTION 'Tarifas conflitantes' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER erp_tariff_integrity BEFORE INSERT OR UPDATE ON lodging_tariffs FOR EACH ROW EXECUTE FUNCTION erp_tariff_conflict();
CREATE TRIGGER erp_version BEFORE UPDATE ON lodging_tariffs FOR EACH ROW EXECUTE FUNCTION erp_bump_version('recordVersion');
CREATE TRIGGER erp_notify AFTER INSERT OR UPDATE OR DELETE ON lodging_tariffs FOR EACH STATEMENT EXECUTE FUNCTION erp_sync_notify('lodgingTariffs');
COMMIT;
