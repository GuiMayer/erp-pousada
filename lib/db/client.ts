import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
function client() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória para acessar o banco")
  const instance = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  globalForPrisma.prisma = instance
  return instance
}
// Initialize on first use so a build never requires a live database or credentials.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client()
    const value = Reflect.get(instance, property)
    return typeof value === "function" ? value.bind(instance) : value
  },
})
