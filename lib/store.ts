// ─── Types ──────────────────────────────────────────────────────────
export type RoomStatus = "disponivel" | "ocupado" | "limpeza" | "bloqueado"

export type TimelineDay = {
  date: string
  label: string
  status: RoomStatus
}

export type Room = {
  id: number
  number: string
  type: string
  status: RoomStatus
  guest?: string
  guestCpf?: string
  checkIn?: string
  checkOut?: string
  checkOutTime?: string // "12:00" default
  blockReason?: string
  blockEndDate?: string
  blockResponsible?: string
  timeline: TimelineDay[]
}

export type Reservation = {
  id: string
  roomId: number
  roomNumber: string
  guestName: string
  cpf: string
  checkIn: string
  checkOut: string
  status: "confirmada" | "checkin" | "checkout" | "cancelada" | "noshow"
  totalValue: number
  cancelTreatment?: "estorno" | "multa" | "credito"
}

export type GuestProfile = {
  cpf: string
  name: string
  totalStays: number
  avgTicket: number
  noShows: number
}

export type Expense = {
  id: string
  description: string
  category: string
  value: number
  dueDate: string
  paid: boolean
}

export type Transaction = {
  id: string
  date: string
  description: string
  value: number
  type: "receita" | "despesa" | "estorno"
  refId?: string
}

export type AuditEntry = {
  id: string
  date: string
  user: string
  action: string
  reference: string
}

export type CashClose = {
  id: string
  date: string
  operator: string
  physicalValue: number
  expectedValue: number
  divergence: number
}

export type UserRole = "operador" | "supervisor"

export type ExpenseCategory = {
  id: string
  label: string
}

// ─── Helper functions ──────────────────────────────────────────────
function getDateISO(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split("T")[0]
}

function getDateLabel(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const day = date.getDate()
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${day} ${months[date.getMonth()]}`
}

function generateTimeline(pattern: RoomStatus[]): TimelineDay[] {
  return pattern.map((status, i) => ({
    date: getDateISO(i),
    label: getDateLabel(i),
    status,
  }))
}

// ─── Mock Data ──────────────────────────────────────────────────────
export const initialRooms: Room[] = [
  {
    id: 1, number: "101", type: "Standard", status: "ocupado",
    guest: "Carlos Mendes", guestCpf: "123.456.789-00",
    checkIn: getDateISO(-2), checkOut: getDateISO(0), checkOutTime: "12:00",
    timeline: generateTimeline(["ocupado", "ocupado", "limpeza", "disponivel", "disponivel", "disponivel", "disponivel"]),
  },
  {
    id: 2, number: "102", type: "Standard", status: "disponivel",
    timeline: generateTimeline(["disponivel", "disponivel", "ocupado", "ocupado", "ocupado", "disponivel", "disponivel"]),
  },
  {
    id: 3, number: "103", type: "Luxo", status: "ocupado",
    guest: "Ana Beatriz Silva", guestCpf: "987.654.321-00",
    checkIn: getDateISO(-1), checkOut: getDateISO(4), checkOutTime: "12:00",
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "limpeza", "disponivel"]),
  },
  {
    id: 4, number: "104", type: "Luxo", status: "bloqueado",
    blockReason: "Reforma do banheiro", blockEndDate: getDateISO(5), blockResponsible: "Joao Manutenção",
    timeline: generateTimeline(["bloqueado", "bloqueado", "bloqueado", "bloqueado", "bloqueado", "bloqueado", "disponivel"]),
  },
  {
    id: 5, number: "201", type: "Suite", status: "disponivel",
    timeline: generateTimeline(["disponivel", "disponivel", "disponivel", "ocupado", "ocupado", "ocupado", "disponivel"]),
  },
  {
    id: 6, number: "202", type: "Suite", status: "ocupado",
    guest: "Roberto Almeida", guestCpf: "111.222.333-44",
    checkIn: getDateISO(-3), checkOut: getDateISO(1), checkOutTime: "12:00",
    timeline: generateTimeline(["ocupado", "ocupado", "limpeza", "disponivel", "disponivel", "ocupado", "ocupado"]),
  },
  {
    id: 7, number: "203", type: "Standard", status: "limpeza",
    timeline: generateTimeline(["limpeza", "disponivel", "ocupado", "ocupado", "ocupado", "disponivel", "disponivel"]),
  },
  {
    id: 8, number: "204", type: "Luxo", status: "ocupado",
    guest: "Juliana Costa", guestCpf: "555.666.777-88",
    checkIn: getDateISO(-1), checkOut: getDateISO(5), checkOutTime: "12:00",
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "limpeza"]),
  },
  {
    id: 9, number: "301", type: "Suite Master", status: "disponivel",
    timeline: generateTimeline(["disponivel", "disponivel", "disponivel", "disponivel", "ocupado", "ocupado", "ocupado"]),
  },
  {
    id: 10, number: "302", type: "Suite Master", status: "bloqueado",
    blockReason: "Infiltração no teto", blockEndDate: getDateISO(3), blockResponsible: "Maria Gerente",
    timeline: generateTimeline(["bloqueado", "bloqueado", "bloqueado", "bloqueado", "disponivel", "disponivel", "disponivel"]),
  },
  {
    id: 11, number: "303", type: "Standard", status: "ocupado",
    guest: "Fernanda Lima", guestCpf: "999.888.777-66",
    checkIn: getDateISO(0), checkOut: getDateISO(6), checkOutTime: "12:00",
    timeline: generateTimeline(["ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado", "ocupado"]),
  },
  {
    id: 12, number: "304", type: "Luxo", status: "disponivel",
    timeline: generateTimeline(["disponivel", "disponivel", "disponivel", "disponivel", "disponivel", "ocupado", "ocupado"]),
  },
]

export const initialReservations: Reservation[] = [
  { id: "R001", roomId: 1, roomNumber: "101", guestName: "Carlos Mendes", cpf: "123.456.789-00", checkIn: getDateISO(-2), checkOut: getDateISO(0), status: "checkin", totalValue: 850 },
  { id: "R002", roomId: 3, roomNumber: "103", guestName: "Ana Beatriz Silva", cpf: "987.654.321-00", checkIn: getDateISO(-1), checkOut: getDateISO(4), status: "checkin", totalValue: 2200 },
  { id: "R003", roomId: 6, roomNumber: "202", guestName: "Roberto Almeida", cpf: "111.222.333-44", checkIn: getDateISO(-3), checkOut: getDateISO(1), status: "checkin", totalValue: 1500 },
  { id: "R004", roomId: 8, roomNumber: "204", guestName: "Juliana Costa", cpf: "555.666.777-88", checkIn: getDateISO(-1), checkOut: getDateISO(5), status: "checkin", totalValue: 3200 },
  { id: "R005", roomId: 11, roomNumber: "303", guestName: "Fernanda Lima", cpf: "999.888.777-66", checkIn: getDateISO(0), checkOut: getDateISO(6), status: "checkin", totalValue: 1800 },
  { id: "R006", roomId: 5, roomNumber: "201", guestName: "Pedro Santos", cpf: "444.333.222-11", checkIn: getDateISO(3), checkOut: getDateISO(6), status: "confirmada", totalValue: 1200 },
  { id: "R007", roomId: 2, roomNumber: "102", guestName: "Lucia Martins", cpf: "777.888.999-00", checkIn: getDateISO(2), checkOut: getDateISO(5), status: "confirmada", totalValue: 950 },
]

export const initialGuests: GuestProfile[] = [
  { cpf: "123.456.789-00", name: "Carlos Mendes", totalStays: 5, avgTicket: 920, noShows: 0 },
  { cpf: "987.654.321-00", name: "Ana Beatriz Silva", totalStays: 3, avgTicket: 2100, noShows: 1 },
  { cpf: "111.222.333-44", name: "Roberto Almeida", totalStays: 8, avgTicket: 1450, noShows: 0 },
  { cpf: "555.666.777-88", name: "Juliana Costa", totalStays: 2, avgTicket: 3000, noShows: 0 },
  { cpf: "999.888.777-66", name: "Fernanda Lima", totalStays: 1, avgTicket: 1800, noShows: 0 },
  { cpf: "444.333.222-11", name: "Pedro Santos", totalStays: 12, avgTicket: 1100, noShows: 2 },
  { cpf: "777.888.999-00", name: "Lucia Martins", totalStays: 4, avgTicket: 980, noShows: 1 },
]

export const initialExpenses: Expense[] = [
  { id: "E001", description: "Conta de Luz", category: "Pousada", value: 1850, dueDate: getDateISO(1), paid: false },
  { id: "E002", description: "Internet Fibra", category: "Pousada", value: 350, dueDate: getDateISO(2), paid: false },
  { id: "E003", description: "Produtos de Limpeza", category: "Manutenção", value: 420, dueDate: getDateISO(5), paid: false },
  { id: "E004", description: "Salario - Recepcionista", category: "Pessoal", value: 2800, dueDate: getDateISO(8), paid: false },
  { id: "E005", description: "Fornecedor de Toalhas", category: "Pousada", value: 680, dueDate: getDateISO(0), paid: true },
  { id: "E006", description: "Manutencao Ar Condicionado", category: "Manutenção", value: 550, dueDate: getDateISO(1), paid: false },
]

export const initialTransactions: Transaction[] = [
  { id: "T001", date: getDateISO(-2), description: "Reserva R001 - Carlos Mendes", value: 850, type: "receita" },
  { id: "T002", date: getDateISO(-1), description: "Reserva R002 - Ana Beatriz", value: 2200, type: "receita" },
  { id: "T003", date: getDateISO(-3), description: "Reserva R003 - Roberto Almeida", value: 1500, type: "receita" },
  { id: "T004", date: getDateISO(-1), description: "Conta de Agua", value: 780, type: "despesa" },
  { id: "T005", date: getDateISO(0), description: "Reserva R005 - Fernanda Lima", value: 1800, type: "receita" },
  { id: "T006", date: getDateISO(0), description: "Fornecedor de Toalhas", value: 680, type: "despesa" },
]

export const initialAuditLog: AuditEntry[] = [
  { id: "A001", date: new Date(Date.now() - 86400000 * 2).toISOString(), user: "supervisor", action: "Estorno realizado", reference: "T004 - Conta de Agua" },
  { id: "A002", date: new Date(Date.now() - 86400000).toISOString(), user: "operador", action: "Desconto aplicado (3%)", reference: "R003 - Roberto Almeida" },
  { id: "A003", date: new Date(Date.now() - 86400000).toISOString(), user: "operador", action: "Cancelamento de reserva", reference: "R008 - Guest Antigo" },
  { id: "A004", date: new Date(Date.now() - 3600000 * 5).toISOString(), user: "operador", action: "No-show registrado", reference: "R009 - Guest Fantasma" },
  { id: "A005", date: new Date(Date.now() - 3600000 * 2).toISOString(), user: "supervisor", action: "Desbloqueio de quarto", reference: "Quarto 104" },
  { id: "A006", date: new Date(Date.now() - 3600000).toISOString(), user: "operador", action: "Diferenca de caixa: R$ -45,00", reference: "Fechamento Turno #12" },
]

export const initialCategories: ExpenseCategory[] = [
  { id: "C001", label: "Pousada" },
  { id: "C002", label: "Pessoal" },
  { id: "C003", label: "Manutenção" },
  { id: "C004", label: "Alimentação" },
]

export const initialCashCloses: CashClose[] = [
  { id: "CC001", date: new Date(Date.now() - 86400000).toISOString(), operator: "operador", physicalValue: 4320, expectedValue: 4365, divergence: -45 },
]
