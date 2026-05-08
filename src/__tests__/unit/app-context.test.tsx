import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useApp } from '../../../lib/app-context'
import { TestWrapper } from '../utils/test-helpers'
import type { Room, Reservation, GuestProfile, POSProduct } from '../../../lib/store'

describe('AppContext', () => {
  it('should initialize with default data', async () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: TestWrapper,
    })

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.rooms.length).toBeGreaterThan(0)
    })

    expect(result.current.rooms).toBeDefined()
    expect(result.current.reservations).toBeDefined()
    expect(result.current.guests).toBeDefined()
    expect(result.current.expenses).toBeDefined()
    expect(result.current.transactions).toBeDefined()
    expect(result.current.auditLog).toBeDefined()
    expect(result.current.posProducts).toBeDefined()
    expect(result.current.posSales).toBeDefined()
  })

  describe('Room Management', () => {
    it('should add a new room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const initialCount = result.current.rooms.length

      const newRoom: Room = {
        id: 999,
        number: '999',
        type: 'Test Room',
        status: 'disponivel',
        timeline: [],
      }

      await act(async () => {
        await result.current.addRoom(newRoom)
      })

      await waitFor(() => {
        expect(result.current.rooms).toHaveLength(initialCount + 1)
      })
      
      expect(result.current.rooms.find(r => r.id === 999)).toEqual(newRoom)
    })

    it('should update a room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const firstRoom = result.current.rooms[0]

      await act(async () => {
        await result.current.updateRoom(firstRoom.id, { status: 'limpeza' })
      })

      await waitFor(() => {
        const updatedRoom = result.current.rooms.find(r => r.id === firstRoom.id)
        expect(updatedRoom?.status).toBe('limpeza')
      })
    })

    it('should remove a room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const firstRoom = result.current.rooms[0]
      const initialCount = result.current.rooms.length

      await act(async () => {
        await result.current.removeRoom(firstRoom.id)
      })

      await waitFor(() => {
        expect(result.current.rooms).toHaveLength(initialCount - 1)
      })
      
      expect(result.current.rooms.find(r => r.id === firstRoom.id)).toBeUndefined()
    })
  })

  describe('Guest Management', () => {
    it('should add a new guest', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newGuest: GuestProfile = {
        cpf: '000.111.222-33',
        name: 'Test Guest',
        totalStays: 0,
        avgTicket: 0,
        noShows: 0,
      }

      await act(async () => {
        await result.current.addGuest(newGuest)
      })

      await waitFor(() => {
        const foundGuest = result.current.findGuest('000.111.222-33')
        expect(foundGuest).toEqual(newGuest)
      })
    })

    it('should not add duplicate guest with same CPF', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newGuest: GuestProfile = {
        cpf: '000.222.333-44',
        name: 'Test Guest',
        totalStays: 0,
        avgTicket: 0,
        noShows: 0,
      }

      await act(async () => {
        await result.current.addGuest(newGuest)
      })

      const countAfterFirst = result.current.guests.length

      await act(async () => {
        await result.current.addGuest(newGuest)
      })

      expect(result.current.guests).toHaveLength(countAfterFirst)
    })

    it('should find guest by CPF', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newGuest: GuestProfile = {
        cpf: '000.333.444-55',
        name: 'Findable Guest',
        totalStays: 1,
        avgTicket: 500,
        noShows: 0,
      }

      await act(async () => {
        await result.current.addGuest(newGuest)
      })

      await waitFor(() => {
        const found = result.current.findGuest('000.333.444-55')
        expect(found).toEqual(newGuest)
      })
    })
  })

  describe('Reservation Management', () => {
    it('should add a new reservation', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const initialCount = result.current.reservations.length

      const newReservation: Reservation = {
        id: 'TEST001',
        roomId: 1,
        roomNumber: '101',
        guestName: 'Test Guest',
        cpf: '123.456.789-00',
        checkIn: '2026-06-01',
        checkOut: '2026-06-05',
        status: 'confirmada',
        totalValue: 1000,
      }

      await act(async () => {
        await result.current.addReservation(newReservation)
      })

      await waitFor(() => {
        expect(result.current.reservations).toHaveLength(initialCount + 1)
      })
      
      expect(result.current.reservations.find(r => r.id === 'TEST001')).toEqual(newReservation)
    })

    it('should update a reservation', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newReservation: Reservation = {
        id: 'TEST002',
        roomId: 1,
        roomNumber: '101',
        guestName: 'Test Guest',
        cpf: '123.456.789-00',
        checkIn: '2026-06-01',
        checkOut: '2026-06-05',
        status: 'confirmada',
        totalValue: 1000,
      }

      await act(async () => {
        await result.current.addReservation(newReservation)
      })

      await act(async () => {
        await result.current.updateReservation('TEST002', { status: 'checkin' })
      })

      await waitFor(() => {
        const updated = result.current.reservations.find(r => r.id === 'TEST002')
        expect(updated?.status).toBe('checkin')
      })
    })
  })

  describe('POS Product Management', () => {
    it('should add a new POS product', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const initialCount = result.current.posProducts.length

      const newProduct: POSProduct = {
        id: 'TEST_PROD',
        name: 'Test Product',
        category: 'Test Category',
        price: 10,
      }

      await act(async () => {
        await result.current.addPOSProduct(newProduct)
      })

      await waitFor(() => {
        expect(result.current.posProducts).toHaveLength(initialCount + 1)
      })
      
      expect(result.current.posProducts.find(p => p.id === 'TEST_PROD')).toEqual(newProduct)
    })

    it('should update a POS product', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newProduct: POSProduct = {
        id: 'TEST_PROD2',
        name: 'Test Product',
        category: 'Test Category',
        price: 10,
      }

      await act(async () => {
        await result.current.addPOSProduct(newProduct)
      })

      await act(async () => {
        await result.current.updatePOSProduct('TEST_PROD2', { price: 15 })
      })

      await waitFor(() => {
        const updated = result.current.posProducts.find(p => p.id === 'TEST_PROD2')
        expect(updated?.price).toBe(15)
      })
    })

    it('should remove a POS product', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const newProduct: POSProduct = {
        id: 'TEST_PROD3',
        name: 'Test Product',
        category: 'Test Category',
        price: 10,
      }

      await act(async () => {
        await result.current.addPOSProduct(newProduct)
      })

      const countAfterAdd = result.current.posProducts.length

      await act(async () => {
        await result.current.removePOSProduct('TEST_PROD3')
      })

      await waitFor(() => {
        expect(result.current.posProducts).toHaveLength(countAfterAdd - 1)
      })
      
      expect(result.current.posProducts.find(p => p.id === 'TEST_PROD3')).toBeUndefined()
    })
  })

  describe('Consumption Management', () => {
    it('should add consumption item to room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const item = {
        id: 'ITEM001',
        label: 'Test Item',
        unitPrice: 10,
        quantity: 2,
      }

      await act(async () => {
        await result.current.addConsumptionItem(1, item)
      })

      await waitFor(() => {
        const consumption = result.current.getConsumption(1)
        expect(consumption).toBeDefined()
        expect(consumption?.items).toHaveLength(1)
        expect(consumption?.items[0]).toEqual(item)
      })
    })

    it('should remove consumption item from room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const item = {
        id: 'ITEM002',
        label: 'Test Item',
        unitPrice: 10,
        quantity: 2,
      }

      await act(async () => {
        await result.current.addConsumptionItem(1, item)
      })

      await act(async () => {
        await result.current.removeConsumptionItem(1, 'ITEM002')
      })

      await waitFor(() => {
        const consumption = result.current.getConsumption(1)
        expect(consumption?.items).toHaveLength(0)
      })
    })

    it('should clear all consumption for a room', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const item1 = {
        id: 'ITEM003',
        label: 'Test Item 1',
        unitPrice: 10,
        quantity: 1,
      }

      const item2 = {
        id: 'ITEM004',
        label: 'Test Item 2',
        unitPrice: 15,
        quantity: 2,
      }

      await act(async () => {
        await result.current.addConsumptionItem(1, item1)
        await result.current.addConsumptionItem(1, item2)
      })

      await act(async () => {
        await result.current.clearConsumption(1)
      })

      await waitFor(() => {
        const consumption = result.current.getConsumption(1)
        expect(consumption).toBeUndefined()
      })
    })
  })

  describe('Audit Log', () => {
    it('should add audit entry', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      const initialCount = result.current.auditLog.length

      await act(async () => {
        await result.current.addAuditEntry({
          user: 'test-user',
          action: 'test-action',
          reference: 'test-reference',
        })
      })

      await waitFor(() => {
        expect(result.current.auditLog).toHaveLength(initialCount + 1)
      })
      
      const latestEntry = result.current.auditLog[0]
      expect(latestEntry.user).toBe('test-user')
      expect(latestEntry.action).toBe('test-action')
      expect(latestEntry.reference).toBe('test-reference')
      expect(latestEntry.id).toBeDefined()
      expect(latestEntry.date).toBeDefined()
    })
  })

  describe('Discount Ceiling', () => {
    it('should update discount ceiling', async () => {
      const { result } = renderHook(() => useApp(), {
        wrapper: TestWrapper,
      })

      // Wait for initial data to load
      await waitFor(() => {
        expect(result.current.rooms.length).toBeGreaterThan(0)
      })

      expect(result.current.discountCeiling).toBe(5)

      act(() => {
        result.current.setDiscountCeiling(10)
      })

      expect(result.current.discountCeiling).toBe(10)
    })
  })
})
