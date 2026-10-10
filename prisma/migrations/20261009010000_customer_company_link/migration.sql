BEGIN;
ALTER TABLE customers ADD COLUMN "companyId" TEXT;
CREATE INDEX "customers_companyId_idx" ON customers("companyId");
ALTER TABLE customers ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES customers(id) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_company_not_self CHECK ("companyId" IS NULL OR "companyId" <> id);
-- Existing people have no inferred employer. Documents/names and reservations
-- must never be used to fabricate the current business affiliation.
CREATE FUNCTION erp_check_company_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW."companyId" IS NOT NULL THEN
    IF NEW."cpfCnpj" !~ '^[0-9]{11}$' THEN
      RAISE EXCEPTION 'Vinculo empresarial exige pessoa fisica' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM customers c WHERE c.id = NEW."companyId" AND c."cpfCnpj" ~ '^[A-Z0-9]{12}[0-9]{2}$' AND c.roles @> '["payer"]' FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Empresa vinculada deve ter CNPJ e papel pagador' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF (NEW."cpfCnpj" !~ '^[A-Z0-9]{12}[0-9]{2}$' OR NOT NEW.roles @> '["payer"]') AND EXISTS (SELECT 1 FROM customers c WHERE c."companyId" = NEW.id) THEN
    RAISE EXCEPTION 'Empresa possui pessoas vinculadas' USING ERRCODE = '23514';
  END IF;
  -- Inactive companies remain valid historical affiliations; new associations
  -- require an active company in the server service. Restores may keep old links.
  RETURN NEW;
END $$;
CREATE TRIGGER erp_customer_company BEFORE INSERT OR UPDATE OF "companyId", "cpfCnpj", roles ON customers FOR EACH ROW EXECUTE FUNCTION erp_check_company_link();
COMMIT;
