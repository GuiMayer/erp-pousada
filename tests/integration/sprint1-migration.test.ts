import { describe, expect, it } from "vitest"
import { Client } from "pg"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

if (new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid").pathname !== "/erp_test") throw new Error("Migração S1 somente em erp_test")
const migration = readFileSync(path.resolve("prisma/migrations/20261009000000_sprint1_contacts_tariffs/migration.sql"), "utf8")
async function fixture(run: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  const schema = `migration_${randomUUID().replaceAll("-", "")}`
  await client.connect()
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`)
    await client.query(`
      CREATE TABLE customers (id text PRIMARY KEY, name text NOT NULL, "cpfCnpj" text NOT NULL, email text, phone text, address text, active bool DEFAULT true, "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp NOT NULL);
      CREATE TABLE guest_profiles (cpf text PRIMARY KEY, name text, "creditValue" numeric DEFAULT 0);
      CREATE TABLE suppliers (id text PRIMARY KEY, name text, cnpj text, email text, phone text, address text, active bool DEFAULT true);
      CREATE TABLE rooms (id int PRIMARY KEY);
      CREATE TABLE reservations (id text PRIMARY KEY, cpf text REFERENCES guest_profiles(cpf), "totalValue" numeric);
      CREATE TABLE pos_products (id text PRIMARY KEY, barcode text);
      CREATE TABLE stock_items ("productId" text, unit text);
      CREATE FUNCTION erp_bump_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE FUNCTION erp_sync_notify() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      INSERT INTO customers VALUES ('stable-id', 'Empresa', '12.abc.345/01de-35', NULL, NULL, NULL, true, now(), now());
      INSERT INTO guest_profiles VALUES ('529.982.247-25', 'Hóspede antigo', 80);
      INSERT INTO suppliers VALUES ('supplier-old', 'Fornecedor sem documento', NULL, NULL, NULL, NULL, true), ('supplier-company', 'Empresa', '12ABC34501DE35', NULL, NULL, NULL, true);
      INSERT INTO reservations VALUES ('reservation-old', '529.982.247-25', 400);
      INSERT INTO rooms VALUES (1);
      INSERT INTO pos_products VALUES ('old-drink', '789123');
      INSERT INTO stock_items VALUES ('old-drink', 'l');
    `)
    await run(client)
  } finally { await client.query("ROLLBACK"); await client.query(`DROP SCHEMA ${schema} CASCADE`); await client.end() }
}
describe("Migração S1 com registros antigos", () => {
  it("preserva IDs, chaves antigas, crédito e reserva e vincula somente por documento", async () => {
    await fixture(async client => {
      await client.query(migration)
      const company = (await client.query("SELECT * FROM customers WHERE id = 'stable-id'")).rows[0]
      expect(company.cpfCnpj).toBe("12ABC34501DE35"); expect(company.roles).toEqual(["payer", "supplier"])
      const guest = (await client.query("SELECT * FROM guest_profiles")).rows[0]
      expect(guest.cpf).toBe("529.982.247-25"); expect(Number(guest.creditValue)).toBe(80); expect(guest.customerId).toBeTruthy()
      expect((await client.query("SELECT * FROM reservations")).rows[0]).toMatchObject({ id: "reservation-old", cpf: "529.982.247-25", guestCount: null, nightlyPrices: null })
      expect((await client.query("SELECT capacity FROM rooms")).rows[0].capacity).toBeNull()
      expect(Number((await client.query("SELECT count(*) FROM customers")).rows[0].count)).toBe(3)
      expect((await client.query("SELECT unit FROM pos_products WHERE id='old-drink'")).rows[0].unit).toBe("l")
      await expect(client.query("INSERT INTO customers (id, name, \"cpfCnpj\", \"updatedAt\") VALUES ('direct-duplicate', 'Duplicada', '12.abc.345/01de-35', now())")).rejects.toThrow("duplicate key")
      await client.query("INSERT INTO customers (id, name, \"cpfCnpj\", \"updatedAt\") VALUES ('direct-person', 'Pessoa', '111.444.777-35', now())")
      expect((await client.query("SELECT \"cpfCnpj\" FROM customers WHERE id='direct-person'")).rows[0].cpfCnpj).toBe("11144477735")
    })
  })
  it("recusa duplicidade antes de alterar dados e permite revisão dos registros originais", async () => {
    await fixture(async client => {
      await client.query("INSERT INTO customers (id, name, \"cpfCnpj\", \"updatedAt\") VALUES ('duplicate', 'Outra empresa', '12ABC34501DE35', now())")
      await expect(client.query(migration)).rejects.toThrow("documentos duplicados")
      await client.query("ROLLBACK")
      expect((await client.query("SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='customers' AND column_name='roles'")).rows[0].count).toBe("0")
      expect(Number((await client.query("SELECT count(*) FROM customers")).rows[0].count)).toBe(2)
    })
  })
})
