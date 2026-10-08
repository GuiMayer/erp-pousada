import { describe, it, expect } from "vitest"
import { Client } from "pg"

const target = new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
if (target.pathname !== "/erp_test") throw new Error("Use exclusivamente erp_test")
async function connectAs(user: string, password: string) {
  const url = new URL(target)
  url.username = user
  url.password = password
  const client = new Client({ connectionString: url.toString() })
  await client.connect()
  return client
}
describe("Credenciais separadas do PostgreSQL", () => {
  it("aplicação pode usar cadastros, mas não alterar schema, migrações ou auditoria", async () => {
    const client = await connectAs("pousada_app", process.env.DB_APP_PASSWORD || "ci-app-only")
    try {
      expect((await client.query("SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user")).rows[0]).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false })
      await client.query("INSERT INTO rooms (id, number, type, status) VALUES (99999, 'ROLE-TEST', 'casal', 'disponivel')")
      await client.query("UPDATE rooms SET number = 'ROLE-UPDATED' WHERE id = 99999")
      await client.query("DELETE FROM rooms WHERE id = 99999")
      await expect(client.query("CREATE TABLE role_forbidden (id int)")).rejects.toMatchObject({ code: "42501" })
      await expect(client.query("SELECT * FROM _prisma_migrations")).rejects.toMatchObject({ code: "42501" })
      await expect(client.query("DELETE FROM audit_entries WHERE false")).rejects.toMatchObject({ code: "42501" })
    } finally { await client.end() }
  })
  it("backup consulta os dados, mas não os modifica", async () => {
    const client = await connectAs("pousada_backup", process.env.DB_BACKUP_PASSWORD || "ci-backup-only")
    try {
      await client.query("SELECT * FROM users LIMIT 1")
      await expect(client.query("DELETE FROM users WHERE false")).rejects.toMatchObject({ code: "42501" })
      await expect(client.query("CREATE TABLE backup_forbidden (id int)")).rejects.toMatchObject({ code: "42501" })
    } finally { await client.end() }
  })
})
