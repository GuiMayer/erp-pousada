import "dotenv/config"
import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "../lib/db/client"

async function main() {
  const existing = await prisma.user.count()
  if (existing) { console.log("Usuários existentes preservados."); return }
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!username || !password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) throw new Error("Defina BOOTSTRAP_ADMIN_USERNAME e BOOTSTRAP_ADMIN_PASSWORD (12 a 72 caracteres).")
  const hashed = await bcrypt.hash(password, 12)
  await prisma.$transaction(async tx => {
    await tx.user.create({ data: { id: randomUUID(), username, password: hashed, role: "supervisor", fullName: "Administrador", createdBy: "setup" } })
    await tx.systemSettings.upsert({ where: { id: "settings-1" }, update: {}, create: { id: "settings-1", pousadaName: process.env.POUSADA_NAME || "Minha Pousada", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 10 } })
  })
  console.log("Administrador e configuração inicial criados, sem dados de demonstração.")
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
