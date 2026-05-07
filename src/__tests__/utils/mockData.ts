import { vi } from 'vitest'
import type {
  Room,
  Reservation,
  GuestProfile,
  AuditEntry,
  POSProduct,
  POSSale,
  POSCartItem,
  Expense,
  Transaction,
  RoomStatus,
} from '../../../lib/store'

// Mock Rooms
export const mockRooms: Room[] = [
  {
    id: 1,
    number: '101',
    type: 'Standard',
    status: 'disponivel' as RoomStatus,
    timeline: [],
  },
  {
    id: 2,
    number: '102',
    type: 'Deluxe',
    status: 'ocupado' as RoomStatus,
    guest: 'João Silva',
    guestCpf: '123.456.789-00',
    checkIn: '2026-05-01',
    checkOut: '2026-05-05',
    timeline: [],
  },
  {
    id: 3,
    number: '103',
    type: 'Suite',
    status: 'limpeza' as RoomStatus,
    timeline: [],
  },
]

// Mock Guests
export const mockGuests: GuestProfile[] = [
  {
    cpf: '123.456.789-00',
    name: 'João Silva',
    totalStays: 5,
    avgTicket: 800,
    noShows: 0,
  },
  {
    cpf: '987.654.321-00',
    name: 'Maria Santos',
    totalStays: 3,
    avgTicket: 1200,
    noShows: 1,
  },
]

// Mock Reservations
export const mockReservations: Reservation[] = [
  {
    id: 'R001',
    roomId: 2,
    roomNumber: '102',
    guestName: 'João Silva',
    cpf: '123.456.789-00',
    checkIn: '2026-05-01',
    checkOut: '2026-05-05',
    status: 'confirmada',
    totalValue: 1000,
  },
]

// Mock POS Products
export const mockPOSProducts: POSProduct[] = [
  {
    id: 'P001',
    name: 'Água Mineral',
    category: 'Bebidas',
    price: 5,
    barcode: '7891234567890',
  },
  {
    id: 'P002',
    name: 'Refrigerante',
    category: 'Bebidas',
    price: 8,
  },
]

// Mock POS Sales
export const mockPOSSales: POSSale[] = [
  {
    id: 'S001',
    date: '2026-05-07T10:00:00.000Z',
    items: [
      {
        id: 'I001',
        product: mockPOSProducts[0],
        quantity: 2,
        discount: 0,
      },
    ],
    subtotal: 10,
    discount: 0,
    total: 10,
    paymentMethod: 'dinheiro',
    amountPaid: 10,
    change: 0,
    operator: 'operador',
    status: 'concluida',
  },
]

// Mock Audit Logs
export const mockAuditLogs: AuditEntry[] = [
  {
    id: 'A001',
    date: '2026-05-07T07:00:00.000Z',
    user: 'operador',
    action: 'login',
    reference: 'Sistema',
  },
]

// Mock Expenses
export const mockExpenses: Expense[] = [
  {
    id: 'E001',
    description: 'Conta de Luz',
    category: 'Utilidades',
    value: 500,
    dueDate: '2026-05-15',
    paid: false,
  },
]

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'T001',
    date: '2026-05-07',
    description: 'Pagamento Reserva',
    value: 1000,
    type: 'receita',
    paymentMethod: 'cartão',
  },
]
