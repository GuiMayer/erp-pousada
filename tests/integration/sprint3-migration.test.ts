import { describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
if(new URL(process.env.DATABASE_URL || 'postgresql://localhost/invalid').pathname !== '/erp_test') throw Error('Migração S3 somente em erp_test')
const migration=readFileSync('prisma/migrations/20261010010000_sprint3_finance/migration.sql','utf8')
async function fixture(run:(c:Client)=>Promise<void>){
  const c=new Client({connectionString:process.env.DATABASE_URL}),schema='s3_migration_'+randomUUID().replaceAll('-','')
  await c.connect()
  try{
    await c.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE expenses(id text PRIMARY KEY,value numeric,paid boolean);
      CREATE TABLE expense_installments(id text PRIMARY KEY,"expenseId" text,value numeric,paid boolean);
      CREATE TABLE accounts_receivable(id text PRIMARY KEY,value numeric,status text,"paidValue" numeric DEFAULT 0 CHECK("paidValue"<=value));
      CREATE TABLE account_receivable_installments(id text PRIMARY KEY,"accountReceivableId" text,value numeric,status text);
      CREATE TABLE transactions(id text PRIMARY KEY);
      CREATE TABLE stays(id text PRIMARY KEY);
      CREATE TABLE pos_sales(id text PRIMARY KEY);
      CREATE TABLE stay_charges(id text PRIMARY KEY);
      CREATE TABLE stay_payments(id text PRIMARY KEY,"transactionId" text UNIQUE REFERENCES transactions(id));
      INSERT INTO expenses VALUES('expense',200,false);
      INSERT INTO expense_installments VALUES('p1','expense',100,true),('p2','expense',100,false);
      INSERT INTO accounts_receivable VALUES('title',600,'pendente',0);
      INSERT INTO account_receivable_installments VALUES('r1','title',300,'pago'),('r2','title',300,'pendente');`)
    await run(c)
  }finally{await c.query('ROLLBACK');await c.query(`DROP SCHEMA ${schema} CASCADE`);await c.end()}
}
describe('Migração financeira preserva dados e limites',()=>{
  it('reconstrói apenas valores conhecidos e permite vários pagamentos vinculados ao mesmo lançamento',async()=>{
    await fixture(async c=>{
      await c.query(migration)
      expect(Number((await c.query('SELECT "paidValue" FROM expenses')).rows[0].paidValue)).toBe(100)
      expect(Number((await c.query('SELECT "paidValue" FROM accounts_receivable')).rows[0].paidValue)).toBe(300)
      await c.query(`INSERT INTO transactions(id) VALUES('receipt'); INSERT INTO stay_payments VALUES('a','receipt'),('b','receipt')`)
      expect((await c.query('SELECT count(*) FROM stay_payments')).rows[0].count).toBe('2')
      await expect(c.query(`UPDATE expenses SET "paidValue"=201`)).rejects.toThrow()
      await expect(c.query(`INSERT INTO payment_allocations VALUES('invalid','receipt','expense','expense',-1)`)).rejects.toThrow()
    })
  })
  it('interrompe e desfaz a migração quando parcelas legadas pagas excedem o título',async()=>{
    await fixture(async c=>{
      await c.query(`UPDATE expense_installments SET value=250 WHERE id='p1'`)
      await expect(c.query(migration)).rejects.toThrow()
      await c.query('ROLLBACK')
      expect((await c.query("SELECT to_regclass('payment_allocations') AS name")).rows[0].name).toBeNull()
      expect((await c.query('SELECT value FROM expense_installments WHERE id=\'p1\'')).rows[0].value).toBe('250')
    })
  })
})
