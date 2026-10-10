import { describe, expect, it } from "vitest"
import { Client } from "pg"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
if(new URL(process.env.DATABASE_URL||'postgresql://localhost/invalid').pathname!=='/erp_test')throw Error('Migração S2 somente em erp_test')
const migration=readFileSync('prisma/migrations/20261010000000_sprint2_stays/migration.sql','utf8')
async function fixture(run:(client:Client)=>Promise<void>){
  const c=new Client({connectionString:process.env.DATABASE_URL}),schema='s2_migration_'+randomUUID().replaceAll('-','')
  await c.connect()
  try{
    await c.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE customers(id text PRIMARY KEY);
      CREATE TABLE rooms(id int PRIMARY KEY);
      CREATE TABLE pos_products(id text PRIMARY KEY);
      CREATE TABLE transactions(id text PRIMARY KEY);
      CREATE TABLE guest_profiles(cpf text PRIMARY KEY,"customerId" text);
      CREATE TABLE reservations(id text PRIMARY KEY,"payerId" text,"guestName" text,"guestCount" int,"roomId" int,"checkIn" timestamp,"checkOut" timestamp,status text,"totalValue" numeric,"nightlyPrices" jsonb,"paidValue" numeric,cpf text);
      CREATE TABLE accounts_receivable(id text PRIMARY KEY,value numeric);
      CREATE TABLE room_consumptions(id text PRIMARY KEY,"roomId" int);
      CREATE TABLE room_consumption_items(id text PRIMARY KEY,"consumptionId" text,label text,"unitPrice" numeric,quantity int);
      CREATE FUNCTION erp_bump_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE FUNCTION erp_sync_notify() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      INSERT INTO rooms VALUES(1),(2);
      INSERT INTO customers VALUES('payer');
      INSERT INTO guest_profiles VALUES('cpf','payer');
      INSERT INTO reservations VALUES('old','payer','Hóspede',NULL,1,'2026-10-09','2026-10-11','checkin',400,NULL,100,'cpf');
      INSERT INTO room_consumptions VALUES('known',1),('orphan',2);
      INSERT INTO room_consumption_items VALUES('drink','known','Bebida antiga',12,2),('unidentified','orphan','Sem estadia',5,1);`)
    await run(c)
  }finally{await c.query('ROLLBACK');await c.query(`DROP SCHEMA ${schema} CASCADE`);await c.end()}
}
describe('Migração S2 sem inventar identidade ou repetir entrega',()=>{
  it('preserva sinal e preço legados, vincula apenas consumo identificável e mantém o órfão',async()=>{
    await fixture(async c=>{
      await c.query(migration)
      const stay=(await c.query('SELECT * FROM stays')).rows[0]
      expect(stay.guestCount).toBeNull();expect(stay.nightlyPrices).toBeNull();expect(Number(stay.lodgingValue)).toBe(400)
      expect((await c.query('SELECT * FROM stay_charges')).rows).toEqual([expect.objectContaining({id:'drink',productId:null})])
      expect(Number((await c.query('SELECT * FROM stay_payments')).rows[0].value)).toBe(100)
      expect((await c.query('SELECT count(*) FROM room_consumption_items')).rows[0].count).toBe('2')
    })
  })
  it('duas estadias ativas no mesmo quarto interrompem e desfazem a migração',async()=>{
    await fixture(async c=>{
      await c.query(`INSERT INTO reservations SELECT 'duplicate',"payerId","guestName","guestCount","roomId","checkIn","checkOut",status,"totalValue","nightlyPrices","paidValue",cpf FROM reservations`)
      await expect(c.query(migration)).rejects.toThrow()
      await c.query('ROLLBACK')
      expect((await c.query("SELECT to_regclass('stays') AS name")).rows[0].name).toBeNull()
      expect((await c.query('SELECT count(*) FROM reservations')).rows[0].count).toBe('2')
    })
  })
})
