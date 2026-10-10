import { seedDemo } from "../lib/server/demo-seed"
import { prisma } from "../lib/db/client"

seedDemo().catch(error => { console.error(error instanceof Error ? error.message : "Falha no seed de demonstração"); process.exitCode = 1 }).finally(() => prisma.$disconnect())
