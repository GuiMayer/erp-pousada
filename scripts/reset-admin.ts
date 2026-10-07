import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../lib/db/client"
async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!username || !password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) throw new Error("Defina usuário e senha forte de bootstrap")
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || user.role !== "supervisor") throw new Error("Supervisor existente não encontrado")
  const hashed = await bcrypt.hash(password, 12)
  await prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: user.id }, data: { password: hashed, active: true } })
    await tx.authSession.deleteMany({ where: { userId: user.id } })
  })
  console.log("Senha do supervisor atualizada e sessões revogadas.")
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
