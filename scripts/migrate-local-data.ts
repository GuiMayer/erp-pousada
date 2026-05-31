import "dotenv/config"
import { prisma } from "../lib/db/client"
import { replaceCollection } from "../lib/server/db/relational-data-service"

const keysToMigrate = [
  "productCategories",
  "posProducts",
  "rooms",
  "guests",
  "restaurantTables",
  "categories",
  "suppliers",
  "customers",
  "bankAccounts",
  "costCenters",
  "users",
  "systemSettings",
  "reservations",
  "consumptions",
  "expenses",
  "transactions",
  "cashCloses",
  "accountsReceivable",
  "bankTransfers",
  "budgets",
  "recurringTransactions",
  "posSales",
  "restaurantOrders",
  "stockItems",
  "stockMovements",
  "recipes",
  "productions",
  "employees",
  "employeeConsumptions",
  "userSessions",
  "auditLog",
]

async function main() {
  const entries = await prisma.localDataEntry.findMany()
  const legacyData = new Map(entries.map(entry => [entry.key, entry.value]))

  if (entries.length === 0) {
    console.log("Nenhum dado legado encontrado em local_data_entries.")
    return
  }

  console.log(`Migrando ${entries.length} colecao(oes) legada(s).`)

  for (const key of keysToMigrate) {
    if (!legacyData.has(key)) continue

    const value = legacyData.get(key)
    if (!Array.isArray(value)) {
      console.warn(`Ignorando ${key}: valor legado nao e uma lista.`)
      continue
    }

    await replaceCollection(key, value)
    console.log(`Migrado: ${key} (${value.length} registro(s))`)
  }
}

main()
  .catch(error => {
    console.error("Falha ao migrar dados legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
