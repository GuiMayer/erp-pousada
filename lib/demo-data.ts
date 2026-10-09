import type { LodgingTariff } from "./lodging-pricing"
import { normalizeDocument } from "./utils/cpf-cnpj-validator"
import seed from "./seed-data.json"
import {
  initialCategories, initialProductCategories, initialPOSProducts,
  initialSystemSettings, initialUsers,
  type Room, type Reservation, type GuestProfile, type POSProduct, type POSSale,
  type RestaurantTable, type RestaurantOrder, type StockItem, type StockMovement,
  type Transaction, type Expense, type Customer, type AccountReceivable,
} from "./store"
import type { DataStore } from "./data/types"

/** Fictitious examples for the explicit browser demo; never a production seed. */
export function createDemoData(now = new Date()) {
  const date = (offset: number) => {
    const value = new Date(now)
    value.setDate(value.getDate() + offset)
    return value.toISOString().slice(0, 10)
  }
  const timestamp = (offset: number, hour = 12) => `${date(offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`
  const rooms: Room[] = seed.rooms.map((room) => ({
    capacity: 3, id: room.id, number: room.number, type: room.type, status: room.status as Room["status"],
    guest: "guest" in room ? room.guest : undefined,
    guestCpf: "guestCpf" in room ? room.guestCpf : undefined,
    checkIn: typeof room.checkInOffset === "number" ? date(room.checkInOffset) : undefined,
    checkOut: typeof room.checkOutOffset === "number" ? date(room.checkOutOffset) : undefined,
    checkOutTime: "checkOutTime" in room ? room.checkOutTime : undefined,
    blockReason: "blockReason" in room ? room.blockReason : undefined,
    blockEndDate: typeof room.blockEndDateOffset === "number" ? date(room.blockEndDateOffset) : undefined,
    blockResponsible: "blockResponsible" in room ? room.blockResponsible : undefined,
    timeline: room.timelinePattern.map((status, index) => ({
      date: date(index), label: date(index), status: status as Room["status"],
    })),
  }))
  const guests: GuestProfile[] = structuredClone(seed.guests)
  const reservations: Reservation[] = seed.reservations.map((reservation) => ({
    id: reservation.id, roomId: reservation.roomId, roomNumber: reservation.roomNumber,
    guestName: reservation.guestName, cpf: reservation.cpf,
    checkIn: date(reservation.checkInOffset), checkOut: date(reservation.checkOutOffset),
    status: reservation.status as Reservation["status"], totalValue: reservation.totalValue,
  }))
  reservations.push(
    { id: "DEMO-R008", roomId: 9, roomNumber: "301", guestName: "Marina Oliveira", cpf: "000.000.000-01", checkIn: date(0), checkOut: date(3), status: "confirmada", totalValue: 1860 },
    { id: "DEMO-R009", roomId: 12, roomNumber: "304", guestName: "Felipe Rocha", cpf: "000.000.000-02", checkIn: date(1), checkOut: date(4), status: "confirmada", totalValue: 1350 },
    { id: "DEMO-R010", roomId: 2, roomNumber: "102", guestName: "Lucia Martins", cpf: guests[6].cpf, checkIn: date(-7), checkOut: date(-4), status: "checkout", totalValue: 960 },
  )
  guests.push(
    { cpf: "000.000.000-01", name: "Marina Oliveira", totalStays: 2, avgTicket: 1860, noShows: 0 },
    { cpf: "000.000.000-02", name: "Felipe Rocha", totalStays: 1, avgTicket: 1350, noShows: 0 },
  )

  const posProducts: POSProduct[] = [
    ...initialPOSProducts.map((product, index) => ({ ...product, trackStock: index < 12 })),
  ]
  const posSales: POSSale[] = []
  const transactions: Transaction[] = []
  const paymentMethods = ["PIX", "Cartao Credito", "Dinheiro", "Cartao Debito"]
  for (let day = -13; day <= 0; day++) {
    for (let saleIndex = 0; saleIndex < 8; saleIndex++) {
      const number = (day + 13) * 8 + saleIndex + 1
      const products = [posProducts[(number * 3) % 19], posProducts[(number + 9) % 19]]
      const items = products.map((product, index) => ({
        id: `DEMO-CI-${number}-${index}`, product: { ...product }, quantity: 1 + (number + index) % 3, discount: 0,
      }))
      const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      const paymentMethod = paymentMethods[saleIndex % paymentMethods.length]
      const sale: POSSale = {
        id: `DEMO-V${String(number).padStart(3, "0")}`, date: timestamp(day, 10 + saleIndex), items,
        subtotal: total, discount: 0, total, paymentMethod, amountPaid: total, change: 0,
        operator: "operador", status: "concluida", customer: "Cliente de demonstração",
      }
      posSales.push(sale)
      transactions.push({
        id: `DEMO-T${number}`, date: date(day), description: `Venda ${sale.id} — recepção`,
        value: total, type: "receita", category: "PDV", paymentMethod, responsible: "operador", refId: sale.id,
      })
    }
  }
  for (const reservation of reservations.filter((item) => item.status === "checkin" || item.status === "checkout")) {
    transactions.push({
      id: `DEMO-T-${reservation.id}`, date: reservation.checkIn,
      description: `Hospedagem — ${reservation.guestName}`, value: reservation.totalValue,
      type: "receita", category: "Hospedagem", paymentMethod: "PIX", responsible: "supervisor", refId: reservation.id,
    })
  }
  const expenses: Expense[] = seed.expenses.map((expense) => ({
    id: expense.id, description: expense.description, category: expense.category,
    value: expense.value, dueDate: date(expense.dueDateOffset), paid: expense.paid,
    paymentDate: expense.paid ? date(0) : undefined,
  }))
  const paidExpenses = [
    { description: "Energia elétrica", category: "Pousada", value: 1850, offset: -6 },
    { description: "Compra de bebidas", category: "Pousada", value: 1240, offset: -3 },
    { description: "Lavanderia e reposição de enxoval", category: "Manutencao", value: 680, offset: 0 },
  ]
  for (const [index, expense] of paidExpenses.entries()) {
    transactions.push({ id: `DEMO-TD${index}`, date: date(expense.offset), description: expense.description, category: expense.category, value: expense.value, type: "despesa", paymentMethod: "Transferencia", responsible: "supervisor" })
  }

  const stockItems: StockItem[] = posProducts.slice(0, 12).map((product, index) => ({
    id: `DEMO-S${index + 1}`, productId: product.id, productName: product.name,
    currentStock: [86, 8, 42, 5, 64, 48, 32, 18, 7, 0, 24, 36][index],
    unit: "un", minimumStock: 10, maximumStock: 120,
    averageCost: Math.round(product.price * 0.4 * 100) / 100,
    lastPurchasePrice: Math.round(product.price * 0.4 * 100) / 100, lastPurchaseDate: date(-2),
  }))
  const stockMovements: StockMovement[] = stockItems.map((item, index) => ({
    id: `DEMO-M${index + 1}`, type: "entrada", productId: item.productId, productName: item.productName,
    quantity: item.currentStock + 12, unit: item.unit, cost: item.averageCost,
    reason: "Reposição semanal — exemplo", timestamp: timestamp(-2), registeredBy: "supervisor",
  }))
  stockMovements.push(...stockItems.map((item, index): StockMovement => ({
    id: `DEMO-MS${index + 1}`, type: "saida", productId: item.productId, productName: item.productName,
    quantity: 12, unit: item.unit, reason: "Consumo registrado — exemplo", timestamp: timestamp(-1), registeredBy: "operador",
  })))
  const restaurantOrders: RestaurantOrder[] = []
  const restaurantTables: RestaurantTable[] = []
  const customers: Customer[] = guests.map((guest, index) => ({
    roles: ["guest", "payer"], id: `DEMO-CLI${index + 1}`, name: guest.name, cpfCnpj: normalizeDocument(guest.cpf),
    email: `hospede${index + 1}@example.com`, notes: "Cadastro fictício para demonstração",
    active: true, createdAt: timestamp(-30), updatedAt: timestamp(0),
  }))
  guests.forEach((guest, index) => { guest.customerId = customers[index].id; guest.active = true })
  const lodgingTariffs: LodgingTariff[] = [...new Set(rooms.map(r => r.type))].flatMap((roomType, index) => [
    { id: 'DEMO-T'+index+'-one', name: roomType+' · uma pessoa', roomType, minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: date(-365), active: true },
    { id: 'DEMO-T'+index+'-group', name: roomType+' · duas ou três pessoas', roomType, minGuests: 2, maxGuests: 3, pricePerPerson: 100, validFrom: date(-365), active: true },
  ])
  const accountsReceivable: AccountReceivable[] = [0, 2, 5].map((index) => ({
    id: `DEMO-AR${index}`, customerId: customers[index].id, customerName: customers[index].name,
    description: "Saldo de hospedagem — exemplo", value: [320, 480, 650][index % 3],
    issueDate: date(-5), dueDate: date(index === 0 ? -1 : index),
    status: index === 0 ? "vencido" : "pendente", category: "Hospedagem",
  }))
  return {
    lodgingTariffs, rooms, reservations, guests, expenses, transactions, posProducts, posSales,
    restaurantTables, restaurantOrders, stockItems, stockMovements, customers, accountsReceivable,
    categories: structuredClone(initialCategories), productCategories: structuredClone(initialProductCategories.filter(category => !category.isRestaurant)),
    employees: [], users: structuredClone(initialUsers), userSessions: [],
    systemSettings: [{ ...initialSystemSettings, contactEmail: "contato@example.com", contactPhone: "", address: "", notifyLowStock: false }],
    auditLog: seed.auditLog.map((entry) => ({ ...entry, date: new Date(now.getTime() - entry.hoursAgo * 3600000).toISOString() })),
    cashCloses: seed.cashCloses.map((entry) => ({ ...entry, date: new Date(now.getTime() - entry.hoursAgo * 3600000).toISOString() })),
    consumptions: rooms.filter((room) => room.status === "ocupado").map((room) => ({
      id: room.id, roomId: room.id,
      items: [{ id: `DEMO-C${room.id}`, label: "Água mineral 500 ml", unitPrice: 5, quantity: 2 }],
    })),
    recipes: [], productions: [], employeeConsumptions: [], suppliers: [],
    bankAccounts: [], bankTransfers: [], costCenters: [], budgets: [], recurringTransactions: [],
  }
}

/** Seed only a completely empty demo store, preserving existing browser data. */
export async function seedDemoIfEmpty(store: Pick<DataStore, "exportAll" | "importAll">) {
  const existing = JSON.parse(await store.exportAll()) as Record<string, unknown>
  if (Object.keys(existing).length > 0) return false
  // One snapshot avoids concurrent read/modify/write operations losing seed records.
  await store.importAll(JSON.stringify(createDemoData()))
  return true
}
