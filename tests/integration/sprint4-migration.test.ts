import {describe,it,expect} from 'vitest'
import {Client} from 'pg'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
if(new URL(process.env.DATABASE_URL||'postgresql://localhost/invalid').pathname!=='/erp_test')throw Error('Migração S4 somente em erp_test')
const migration=readFileSync('prisma/migrations/20261011010000_sprint4_inventory/migration.sql','utf8')
describe('Migração S4 conserva abertura sem adivinhar validade',()=>{
 it('preserva quantidade e valor físico, marca estimativa e exclui restaurante/saldo vazio',async()=>{
  const client=new Client({connectionString:process.env.DATABASE_URL}),schema='s4_migration_'+randomUUID().replaceAll('-','');await client.connect()
  try{
   await client.query(`CREATE SCHEMA ${schema};SET search_path TO ${schema};
    CREATE TABLE suppliers(id text PRIMARY KEY);CREATE TABLE expenses(id text PRIMARY KEY);
    CREATE TABLE product_categories(id text PRIMARY KEY,"isRestaurant" boolean);
    CREATE TABLE pos_products(id text PRIMARY KEY,"categoryId" text);
    CREATE TABLE stock_items(id text PRIMARY KEY,"productId" text,"currentStock" numeric,"averageCost" numeric);
    CREATE TABLE stock_movements(id text PRIMARY KEY);
    CREATE FUNCTION erp_bump_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE FUNCTION erp_sync_notify() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
    INSERT INTO product_categories VALUES('drinks',false),('restaurant',true);
    INSERT INTO pos_products VALUES('water','drinks'),('food','restaurant'),('empty','drinks');
    INSERT INTO stock_items VALUES('stock','water',20,2.56),('foodstock','food',5,10),('emptystock','empty',0,0);`)
   await client.query(migration);const rows=await client.query('SELECT * FROM stock_lots')
   expect(rows.rows).toHaveLength(1);const row=rows.rows[0];expect(Number(row.quantity)).toBe(20);expect(Number(row.remainingValue)).toBe(51.2);expect(row.status).toBe('unverified');expect(row.expiresAt).toBeNull();expect(row.costEstimated).toBe(true)
   const stocks=await client.query(`SELECT "currentStock" FROM stock_items WHERE id='stock'`);expect(Number(stocks.rows[0].currentStock)).toBe(20)
  }finally{await client.query('ROLLBACK');await client.query(`DROP SCHEMA ${schema} CASCADE`);await client.end()}
 })
})
