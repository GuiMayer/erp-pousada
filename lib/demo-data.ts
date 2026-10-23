import { stayBalance } from "./stays"
import { cashIncoming } from "./payments"
import { pousadaProducts } from "./pousada-scope"
import { quoteLodging, type LodgingTariff } from "./lodging-pricing"
import { normalizeDocument } from "./utils/cpf-cnpj-validator"
import { businessDay } from "./utils/business-values"
import seed from "./seed-data.json"
import {
  initialCategories, initialProductCategories, initialPOSProducts,
  initialSystemSettings, initialUsers,
  type Room, type Reservation, type GuestProfile, type POSProduct, type POSSale,
  type RestaurantTable, type RestaurantOrder, type StockItem, type StockMovement,
  type Transaction, type Expense, type Customer, type AccountReceivable, type RoomConsumption,
} from "./store"
import type { DataStore } from "./data/types"
import type { Stay } from "./stays"
import { getDataConfig } from "./data/config"

/** Fictitious examples for the explicit browser demo; never a production seed. */
export function createDemoData(now = new Date()) {
  const date = (offset: number) => {
    const value = new Date(businessDay(now) + "T12:00:00Z")
    value.setUTCDate(value.getUTCDate() + offset)
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
    { id: "DEMO-R010", roomId: 2, roomNumber: "102", guestName: "Lúcia Martins", cpf: guests[6].cpf, checkIn: date(-7), checkOut: date(-4), status: "checkout", totalValue: 960 },
  )
  // One late departure to exercise extension/check-out, without inventing a future stay.
  rooms.find(r => r.id === 1)!.checkOut = date(-1)
  reservations.find(r => r.id === "R001")!.checkOut = date(-1)
  // A company group arriving tomorrow, plus arrivals throughout the next two weeks.
  const laterReservation = reservations.find(r => r.id === "R007")!
  laterReservation.checkIn = date(5); laterReservation.checkOut = date(8)
  reservations.push(
    ...[2, 5].map((roomId): Reservation => ({
      id: `DEMO-GROUP-${roomId}`, groupId: "DEMO-GROUP-TOMORROW", roomId,
      roomNumber: rooms.find(r => r.id === roomId)!.number, guestName: guests[0].name, cpf: guests[0].cpf,
      checkIn: date(1), checkOut: date(3), status: "confirmada", totalValue: 0,
    })),
    ...[6, 9, 12].map((offset, index): Reservation => ({
      id: `DEMO-FUTURE-${offset}`, roomId: 12, roomNumber: "304", guestName: guests[5].name, cpf: guests[5].cpf,
      checkIn: date(offset), checkOut: date(offset + 2), status: "confirmada", totalValue: 0,
    })),
    { id: "DEMO-CANCELLED", roomId: 5, roomNumber: "201", guestName: guests[5].name, cpf: guests[5].cpf,
      checkIn: date(-5), checkOut: date(-3), status: "cancelada", totalValue: 0,
      cancellationReason: "Hóspede mudou os planos da viagem — exemplo", cancelledAt: timestamp(-6), cancelledBy: "supervisor" },
    { id: "DEMO-NOSHOW", roomId: 12, roomNumber: "304", guestName: guests[6].name, cpf: guests[6].cpf,
      checkIn: date(-3), checkOut: date(-1), status: "noshow", totalValue: 0 },
  )
  guests.push(
    { cpf: "000.000.000-01", name: "Marina Oliveira", totalStays: 2, avgTicket: 1860, noShows: 0 },
    { cpf: "000.000.000-02", name: "Felipe Rocha", totalStays: 1, avgTicket: 1350, noShows: 0 },
  )

  // Synthetic documents for fixtures only, with valid check digits for testing forms.
  const documents = new Map<string, string>()
  guests.forEach((guest, index) => {
    const digits = String(100000000 + index * 1237).split("").map(Number)
    for (let size = 9; size <= 10; size++) {
      const remainder = digits.reduce((sum, digit, i) => sum + digit * (size + 1 - i), 0) * 10 % 11
      digits.push(remainder === 10 ? 0 : remainder)
    }
    const cpf = digits.join("")
    documents.set(normalizeDocument(guest.cpf), cpf)
    guest.cpf = cpf
  })
  reservations.forEach(r => { r.cpf = documents.get(normalizeDocument(r.cpf))! })
  rooms.forEach(r => { if (r.guestCpf) r.guestCpf = documents.get(normalizeDocument(r.guestCpf)) })

  const posProducts: POSProduct[] = [
    ...pousadaProducts(initialPOSProducts, initialProductCategories).map(product => ({ ...product, trackStock: true })),
  ]
  const posSales: POSSale[] = []
  const transactions: Transaction[] = []
  const paymentMethods = ["PIX", "Cartao Credito", "Dinheiro", "Cartao Debito"]
  for (let day = -13; day <= 0; day++) {
    for (let saleIndex = 0; saleIndex < 8; saleIndex++) {
      const number = (day + 13) * 8 + saleIndex + 1
      const products = [posProducts[(number * 3) % posProducts.length], posProducts[(number + 9) % posProducts.length]]
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
  customers.push({ id: "DEMO-COMPANY", name: "Empresa Horizonte · Exemplo", cpfCnpj: "12ABC34501DE35", roles: ["payer"], active: true, createdAt: timestamp(-30), updatedAt: timestamp(0) })
  customers[0].companyId = "DEMO-COMPANY"
  reservations.push(...[2, 5].map((roomId, index): Reservation => ({
    id: `DEMO-CREDIT-${index}`, roomId, roomNumber: rooms.find(r => r.id === roomId)!.number,
    guestName: guests[0].name, cpf: guests[0].cpf, checkIn: date(-11 + index * 3), checkOut: date(-9 + index * 3),
    status: "checkout", totalValue: 0,
  })))
  const lodgingTariffs: LodgingTariff[] = [...new Set(rooms.map(r => r.type))].flatMap((roomType, index) => [
    { id: 'DEMO-T'+index+'-one', name: roomType+' · uma pessoa', roomType, minGuests: 1, maxGuests: 1, pricePerPerson: 120, validFrom: date(-365), active: true },
    { id: 'DEMO-T'+index+'-group', name: roomType+' · duas ou três pessoas', roomType, minGuests: 2, maxGuests: 3, pricePerPerson: 100, validFrom: date(-365), active: true },
  ])
  for (const [index, r] of reservations.entries()) {
    const person = customers.find(c => c.cpfCnpj === r.cpf)!
    r.guestCount = 2; r.payerId = person.companyId ?? person.id; r.recordVersion = 0
    const quote = quoteLodging(rooms.find(room => room.id === r.roomId)!, lodgingTariffs, { roomId: r.roomId, guestCount: 2, checkIn: r.checkIn, checkOut: r.checkOut })
    r.totalValue = quote.total; r.originalValue = quote.total; r.nightlyPrices = quote.nights
    r.paidValue = r.status === "checkout" && !r.id.startsWith("DEMO-CREDIT-") ? r.totalValue : r.status === "checkin" || r.id.startsWith("DEMO-CREDIT-") || (r.id === "DEMO-R008" || r.id === "DEMO-R009") ? Math.min(100, r.totalValue) : 0
    if (r.paidValue > 0) transactions.push({ id: `DEMO-T-BOOKING-${index}`, date: timestamp(0), description: `Hospedagem ${r.id}`, refId: `Hospedagem ${r.id}`, value: r.paidValue, type: "receita", paymentMethod: "PIX", accountId: "DEMO-BANK", responsible: "supervisor", originType: "reservation", originId: r.id })
  }
  const consumptionExamples: Record<number, [string, number][]> = {
    1: [["P001", 1]],
    3: [["P005", 2], ["P002", 1]],
    6: [],
    8: [["P007", 3], ["P001", 2]],
    11: [],
  }
  const consumptions: RoomConsumption[] = rooms.filter(room => room.status === "ocupado").map(room => ({
    id: room.id, roomId: room.id,
    items: (consumptionExamples[room.id] ?? []).map(([productId, quantity]) => {
      const product = posProducts.find(p => p.id === productId)!
      return { id: `DEMO-C${room.id}-${productId}`, label: product.name, unitPrice: product.price, quantity }
    }),
  }))
  const stays: Stay[] = reservations.filter(r => ["checkin", "checkout"].includes(r.status)).map(r => ({
    id: `demo-stay-${r.id}`, reservationId: r.id, payerId: r.payerId, guestName: r.guestName,
    guestCount: r.guestCount, roomId: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut,
    status: r.status === "checkin" ? "active" : "closed", lodgingValue: r.totalValue,
    nightlyPrices: r.nightlyPrices, recordVersion: 0, recordedAt: `${r.checkIn}T15:00:00.000Z`,
    endedAt: r.status === "checkout" ? `${r.checkOut}T15:00:00.000Z` : undefined,
    occupants: [{ id: `DEMO-OCC-${r.id}`, name: r.guestName, customerId: customers.find(c => c.cpfCnpj === r.cpf)!.id }],
    allocations: [{ id: `DEMO-ALLOC-${r.id}`, roomId: r.roomId, start: r.checkIn, end: r.checkOut }],
    charges: r.status === "checkin" ? (consumptions.find(c => c.roomId === r.roomId)?.items ?? []).map(item => ({ ...item, status: "active", createdAt: timestamp(0) })) : [],
    payments: r.paidValue ? [{ id: `DEMO-PAY-${r.id}`, value: r.paidValue, bucket: "lodging", method: "PIX", createdAt: timestamp(0), transactionId: `DEMO-T-BOOKING-${reservations.indexOf(r)}` }] : [],
  }))
  const settled = stays.find(s => s.status === "active" && s.roomId === 6)!
  const water = posProducts.find(p => p.id === "P001")!
  settled.charges.push({ id: "DEMO-SETTLED-CONSUMPTION", productId: water.id, label: water.name, unitPrice: water.price, quantity: 2, status: "active", createdAt: timestamp(-1) })
  settled.payments.push({ id: "DEMO-SETTLED-PAYMENT", value: water.price * 2, bucket: "consumption", method: "PIX", createdAt: timestamp(-1), transactionId: "DEMO-SETTLED-TX" })
  transactions.push({ id: "DEMO-SETTLED-TX", date: timestamp(-1), description: `Bebidas quitadas — ${settled.reservationId}`, refId: `Hospedagem ${settled.reservationId}`, value: water.price * 2, type: "receita", paymentMethod: "PIX", accountId: "DEMO-BANK", responsible: "supervisor", originType: "stay", originId: settled.id })
  const accountsReceivable: AccountReceivable[] = stays.filter(s => s.status === "closed" && stayBalance(s).balance > 0).map((stay, index) => ({
    id: `DEMO-AR${index}`, sourceStayId: stay.id, customerId: stay.payerId!, customerName: customers.find(c => c.id === stay.payerId)!.name,
    description: `Hospedagem ${stay.reservationId} · ${stay.guestName} · quarto ${rooms.find(r => r.id === stay.roomId)!.number}`,
    value: stayBalance(stay).balance, paidValue: 0, issueDate: stay.checkOut, dueDate: date(index === 0 ? -1 : 3),
    status: index === 0 ? "vencido" : "pendente", category: "Hospedagem", recordVersion: 0,
  }))
  // Payment movements identify their real account or cash turn, including examples.
  const cashCloses = Array.from({ length: 14 }, (_, index) => {
    const offset = index - 13, id = offset === 0 ? "DEMO-OPEN-CASH" : `DEMO-CASH-${index}`
    const entries = transactions.filter(t => businessDay(t.date) === date(offset) && t.paymentMethod === "Dinheiro")
    entries.forEach(t => { t.cashSessionId = id })
    const expected = 200 + entries.reduce((sum, t) => sum + Math.round(t.value * 100) * (cashIncoming(t.type) ? 1 : -1), 0) / 100
    return { id, date: timestamp(offset), status: offset === 0 ? "aberto" as const : "fechado" as const, openedAt: timestamp(offset, 9), closedAt: offset === 0 ? undefined : timestamp(offset, 22), operator: "supervisor", responsibleUserId: "demo-supervisor", openingValue: 200, expectedValue: expected, physicalValue: offset === 0 ? 0 : expected, divergence: 0, retainedValue: 200, withdrawnValue: offset === 0 ? 0 : expected - 200, closedBy: offset === 0 ? undefined : "supervisor" }
  })
  for (const entry of transactions) if (entry.paymentMethod !== "Dinheiro") entry.accountId = "DEMO-BANK"
  const bankBalance = 5000 + transactions.filter(t => t.accountId === "DEMO-BANK").reduce((sum, t) => sum + Math.round(t.value * 100) * (cashIncoming(t.type) ? 1 : -1), 0) / 100
  const auditLog = reservations.map((r, i) => ({ id: `DEMO-AUDIT-${i}`, date: timestamp(0), user: "supervisor", action: "Reserva cadastrada", reference: r.id, entityType: "reservations", entityId: r.id, operation: "create" as const, metadata: { after: { guestName: r.guestName, roomId: r.roomId, totalValue: r.totalValue, paidValue: r.paidValue, payerId: r.payerId }, reason: "Cenário fictício de demonstração" } }))
  return {
    lodgingTariffs, rooms, reservations, stays, guests, expenses, transactions, posProducts, posSales,
    restaurantTables, restaurantOrders, stockItems, stockMovements, customers, accountsReceivable,
    categories: structuredClone(initialCategories), productCategories: structuredClone(initialProductCategories.filter(category => !category.isRestaurant)),
    employees: [], users: structuredClone(initialUsers), userSessions: [],
    systemSettings: [{ ...initialSystemSettings, contactEmail: "contato@example.com", contactPhone: "", address: "", notifyLowStock: false }],
    auditLog, cashCloses,
    consumptions,
    recipes: [], productions: [], employeeConsumptions: [], suppliers: [],
    bankAccounts: [{ id: "DEMO-BANK", name: "Conta de demonstração", type: "corrente", active: true, initialBalance: 5000, currentBalance: bankBalance }], bankTransfers: [], costCenters: [], budgets: [], recurringTransactions: [],
  }
}

/** Replace only the explicitly selected browser demo, once per server start/scenario. */
export async function seedDemoSession(store: Pick<DataStore, "exportAll" | "importAll">, startedAt: string) {
  if (getDataConfig().adapter !== "demo-localStorage") throw new Error("Exemplos disponíveis apenas na demonstração do navegador")
  const anchor = new Date(startedAt)
  if (!Number.isFinite(anchor.getTime())) throw new Error("Data de início da demonstração inválida")
  const id = `room-scenarios-3:${anchor.toISOString()}`
  const existing = JSON.parse(await store.exportAll()) as { demoScenario?: { id: string } }
  if (existing.demoScenario?.id === id) return false
  await store.importAll(JSON.stringify({ ...createDemoData(anchor), demoScenario: { id, startedAt: anchor.toISOString() } }))
  return true
}

export async function initializeBrowserDemo(store: Pick<DataStore, "exportAll" | "importAll">) {
  if (getDataConfig().adapter !== "demo-localStorage") throw new Error("Exemplos disponíveis apenas na demonstração do navegador")
  const response = await fetch("/api/demo/session", { cache: "no-store" })
  if (!response.ok) throw new Error("Não foi possível iniciar os exemplos de demonstração. Recarregue a página.")
  const { startedAt } = await response.json() as { startedAt: string }
  const seed = () => seedDemoSession(store, startedAt)
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("erp-demo-booking", seed) : seed()
}
