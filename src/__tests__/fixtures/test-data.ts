/**
 * Test Data Fixtures
 * 
 * Reusable test data for consistent testing across the application
 */

import type { Room, GuestProfile, POSProduct, Reservation } from '../../../lib/store'

/**
 * Valid CPF numbers for testing
 * These are mathematically valid CPFs that pass checksum validation
 */
export const VALID_CPFS = {
  OPERADOR: '111.444.777-35',
  SUPERVISOR: '123.456.789-09',
  GUEST_1: '987.654.321-00',
  GUEST_2: '456.789.123-45',
  GUEST_3: '321.654.987-60',
} as const

/**
 * Test guest profiles
 */
export const TEST_GUESTS: Record<string, GuestProfile> = {
  REGULAR: {
    cpf: VALID_CPFS.GUEST_1,
    name: 'João Silva',
    totalStays: 5,
    avgTicket: 350.00,
    noShows: 0,
  },
  VIP: {
    cpf: VALID_CPFS.GUEST_2,
    name: 'Maria Santos',
    totalStays: 15,
    avgTicket: 850.00,
    noShows: 0,
  },
  NEW: {
    cpf: VALID_CPFS.GUEST_3,
    name: 'Pedro Costa',
    totalStays: 0,
    avgTicket: 0,
    noShows: 0,
  },
}

/**
 * Test rooms
 */
export const TEST_ROOMS: Record<string, Room> = {
  AVAILABLE: {
    id: 101,
    number: '101',
    type: 'Standard',
    status: 'disponivel',
    timeline: [],
  },
  OCCUPIED: {
    id: 102,
    number: '102',
    type: 'Deluxe',
    status: 'ocupado',
    guest: 'João Silva',
    guestCpf: VALID_CPFS.GUEST_1,
    timeline: [],
  },
  BLOCKED: {
    id: 103,
    number: '103',
    type: 'Suite',
    status: 'bloqueado',
    blockReason: 'Manutenção',
    timeline: [],
  },
}

/**
 * Test POS products
 */
export const TEST_POS_PRODUCTS: Record<string, POSProduct> = {
  WATER: {
    id: 'PROD_001',
    name: 'Água Mineral',
    category: 'Bebidas',
    price: 5.00,
    stock: 100,
    unit: 'un',
    barcode: '7891234567890',
  },
  BEER: {
    id: 'PROD_002',
    name: 'Cerveja',
    category: 'Bebidas',
    price: 8.00,
    stock: 50,
    unit: 'un',
    barcode: '7891234567891',
  },
  SNACK: {
    id: 'PROD_003',
    name: 'Salgadinho',
    category: 'Alimentos',
    price: 6.50,
    stock: 30,
    unit: 'un',
    barcode: '7891234567892',
  },
}

/**
 * Test reservations
 */
export const TEST_RESERVATIONS: Record<string, Reservation> = {
  CONFIRMED: {
    id: 'RES_001',
    roomId: 101,
    roomNumber: '101',
    guestName: 'João Silva',
    cpf: VALID_CPFS.GUEST_1,
    checkIn: new Date('2026-05-10'),
    checkOut: new Date('2026-05-15'),
    status: 'confirmada',
    totalValue: 1500.00,
  },
  PENDING: {
    id: 'RES_002',
    roomId: 102,
    roomNumber: '102',
    guestName: 'Maria Santos',
    cpf: VALID_CPFS.GUEST_2,
    checkIn: new Date('2026-05-12'),
    checkOut: new Date('2026-05-18'),
    status: 'pendente',
    totalValue: 2400.00,
  },
}

/**
 * Create a test room with custom properties
 */
export function createTestRoom(overrides: Partial<Room> = {}): Room {
  return {
    ...TEST_ROOMS.AVAILABLE,
    ...overrides,
  }
}

/**
 * Create a test guest with custom properties
 */
export function createTestGuest(overrides: Partial<GuestProfile> = {}): GuestProfile {
  return {
    ...TEST_GUESTS.NEW,
    ...overrides,
  }
}

/**
 * Create a test POS product with custom properties
 */
export function createTestProduct(overrides: Partial<POSProduct> = {}): POSProduct {
  return {
    ...TEST_POS_PRODUCTS.WATER,
    ...overrides,
  }
}

/**
 * Create a test reservation with custom properties
 */
export function createTestReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    ...TEST_RESERVATIONS.CONFIRMED,
    ...overrides,
  }
}

/**
 * Get a batch of test rooms for seeding
 */
export function getTestRoomsBatch(): Room[] {
  return Object.values(TEST_ROOMS)
}

/**
 * Get a batch of test guests for seeding
 */
export function getTestGuestsBatch(): GuestProfile[] {
  return Object.values(TEST_GUESTS)
}

/**
 * Get a batch of test products for seeding
 */
export function getTestProductsBatch(): POSProduct[] {
  return Object.values(TEST_POS_PRODUCTS)
}
