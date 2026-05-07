import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../../lib/auth-context'
import { AppProvider, useApp } from '../../../lib/app-context'
import type { Room, Reservation } from '../../../lib/store'

// Wrapper component that provides both contexts
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>{children}</AppProvider>
    </AuthProvider>
  )
}

describe('Integration Tests', () => {
  describe('Complete Check-in Flow', () => {
    it('should complete a full check-in process', () => {
      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      })
      const { result: appResult } = renderHook(() => useApp(), {
        wrapper: AllProviders,
      })

      // Step 1: Login as operador
      act(() => {
        authResult.current.login('operador', '1234')
      })

      expect(authResult.current.isLoggedIn).toBe(true)

      // Step 2: Find an available room
      const availableRoom = appResult.current.rooms.find(r => r.status === 'disponivel')
      expect(availableRoom).toBeDefined()

      // Step 3: Add a guest
      act(() => {
        appResult.current.addGuest({
          cpf: '000.111.222-99',
          name: 'Integration Test Guest',
          totalStays: 0,
          avgTicket: 0,
          noShows: 0,
        })
      })

      // Step 4: Create a reservation
      const newReservation: Reservation = {
        id: 'INT_TEST_001',
        roomId: availableRoom!.id,
        roomNumber: availableRoom!.number,
        guestName: 'Integration Test Guest',
        cpf: '000.111.222-99',
        checkIn: '2026-05-07',
        checkOut: '2026-05-10',
        status: 'confirmada',
        totalValue: 900,
      }

      act(() => {
        appResult.current.addReservation(newReservation)
      })

      // Step 5: Update room status to occupied
      act(() => {
        appResult.current.updateRoom(availableRoom!.id, {
          status: 'ocupado',
          guest: 'Integration Test Guest',
          guestCpf: '000.111.222-99',
          checkIn: '2026-05-07',
          checkOut: '2026-05-10',
        })
      })

      // Step 6: Update reservation status to checked-in
      act(() => {
        appResult.current.updateReservation('INT_TEST_001', {
          status: 'checkin',
        })
      })

      // Step 7: Add audit log entry
      act(() => {
        appResult.current.addAuditEntry({
          user: 'operador',
          action: 'check-in',
          reference: `Quarto ${availableRoom!.number} - Integration Test Guest`,
        })
      })

      // Verify final state
      const updatedRoom = appResult.current.rooms.find(r => r.id === availableRoom!.id)
      expect(updatedRoom?.status).toBe('ocupado')
      expect(updatedRoom?.guest).toBe('Integration Test Guest')

      const updatedReservation = appResult.current.reservations.find(r => r.id === 'INT_TEST_001')
      expect(updatedReservation?.status).toBe('checkin')

      const guest = appResult.current.findGuest('000.111.222-99')
      expect(guest).toBeDefined()
    })
  })

  describe('Complete Check-out Flow with Consumption', () => {
    it('should complete a full check-out process with room consumption', () => {
      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      })
      const { result: appResult } = renderHook(() => useApp(), {
        wrapper: AllProviders,
      })

      // Step 1: Login as operador
      act(() => {
        authResult.current.login('operador', '1234')
      })

      // Step 2: Find an occupied room
      const occupiedRoom = appResult.current.rooms.find(r => r.status === 'ocupado')
      expect(occupiedRoom).toBeDefined()

      // Step 3: Add consumption items
      act(() => {
        appResult.current.addConsumptionItem(occupiedRoom!.id, {
          id: 'CONS_001',
          label: 'Água Mineral',
          unitPrice: 5,
          quantity: 2,
        })
        appResult.current.addConsumptionItem(occupiedRoom!.id, {
          id: 'CONS_002',
          label: 'Refrigerante',
          unitPrice: 8,
          quantity: 3,
        })
      })

      // Step 4: Verify consumption
      const consumption = appResult.current.getConsumption(occupiedRoom!.id)
      expect(consumption?.items).toHaveLength(2)

      const totalConsumption = consumption!.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      )
      expect(totalConsumption).toBe(34) // (5 * 2) + (8 * 3)

      // Step 5: Add transaction for consumption
      act(() => {
        appResult.current.addTransaction({
          id: 'TRANS_CONS_001',
          date: '2026-05-07',
          description: 'Consumo Quarto ' + occupiedRoom!.number,
          value: totalConsumption,
          type: 'receita',
          paymentMethod: 'dinheiro',
        })
      })

      // Step 6: Clear consumption
      act(() => {
        appResult.current.clearConsumption(occupiedRoom!.id)
      })

      // Step 7: Update room to cleaning status
      act(() => {
        appResult.current.updateRoom(occupiedRoom!.id, {
          status: 'limpeza',
          guest: undefined,
          guestCpf: undefined,
          checkIn: undefined,
          checkOut: undefined,
        })
      })

      // Step 8: Add audit log
      act(() => {
        appResult.current.addAuditEntry({
          user: 'operador',
          action: 'check-out',
          reference: `Quarto ${occupiedRoom!.number}`,
        })
      })

      // Verify final state
      const updatedRoom = appResult.current.rooms.find(r => r.id === occupiedRoom!.id)
      expect(updatedRoom?.status).toBe('limpeza')
      expect(updatedRoom?.guest).toBeUndefined()

      const clearedConsumption = appResult.current.getConsumption(occupiedRoom!.id)
      expect(clearedConsumption).toBeUndefined()
    })
  })

  describe('POS Sale Flow', () => {
    it('should complete a full POS sale transaction', () => {
      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      })
      const { result: appResult } = renderHook(() => useApp(), {
        wrapper: AllProviders,
      })

      // Step 1: Login as operador
      act(() => {
        authResult.current.login('operador', '1234')
      })

      // Step 2: Get available products
      const products = appResult.current.posProducts
      expect(products.length).toBeGreaterThan(0)

      const product1 = products[0]
      const product2 = products[1]

      // Step 3: Create a sale
      const saleItems = [
        {
          id: 'SALE_ITEM_001',
          product: product1,
          quantity: 2,
          discount: 0,
        },
        {
          id: 'SALE_ITEM_002',
          product: product2,
          quantity: 1,
          discount: 5,
        },
      ]

      const subtotal = (product1.price * 2) + product2.price
      const discount = 5
      const total = subtotal - discount

      act(() => {
        appResult.current.addPOSSale({
          id: 'SALE_001',
          date: new Date().toISOString(),
          items: saleItems,
          subtotal,
          discount,
          total,
          paymentMethod: 'cartão',
          amountPaid: total,
          change: 0,
          operator: 'operador',
          status: 'concluida',
        })
      })

      // Step 4: Add transaction
      act(() => {
        appResult.current.addTransaction({
          id: 'TRANS_SALE_001',
          date: '2026-05-07',
          description: 'Venda POS',
          value: total,
          type: 'receita',
          paymentMethod: 'cartão',
        })
      })

      // Step 5: Add audit log
      act(() => {
        appResult.current.addAuditEntry({
          user: 'operador',
          action: 'venda-pos',
          reference: `Venda SALE_001 - R$ ${total.toFixed(2)}`,
        })
      })

      // Verify final state
      const sale = appResult.current.posSales.find(s => s.id === 'SALE_001')
      expect(sale).toBeDefined()
      expect(sale?.status).toBe('concluida')
      expect(sale?.total).toBe(total)
    })
  })

  describe('Supervisor Operations', () => {
    it('should allow supervisor to perform privileged operations', () => {
      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      })
      const { result: appResult } = renderHook(() => useApp(), {
        wrapper: AllProviders,
      })

      // Step 1: Login as supervisor
      act(() => {
        authResult.current.login('supervisor', 'admin')
      })

      expect(authResult.current.isSupervisor).toBe(true)

      // Step 2: Add a new room (supervisor privilege)
      const newRoom: Room = {
        id: 9999,
        number: '999',
        type: 'Presidential Suite',
        status: 'disponivel',
        timeline: [],
      }

      act(() => {
        appResult.current.addRoom(newRoom)
      })

      // Step 3: Update discount ceiling (supervisor privilege)
      act(() => {
        appResult.current.setDiscountCeiling(15)
      })

      expect(appResult.current.discountCeiling).toBe(15)

      // Step 4: Add expense category
      act(() => {
        appResult.current.addCategory('Nova Categoria')
      })

      // Step 5: Add audit log
      act(() => {
        appResult.current.addAuditEntry({
          user: 'supervisor',
          action: 'configuração',
          reference: 'Alteração de teto de desconto para 15%',
        })
      })

      // Verify final state
      const addedRoom = appResult.current.rooms.find(r => r.id === 9999)
      expect(addedRoom).toBeDefined()
      expect(appResult.current.discountCeiling).toBe(15)
    })
  })

  describe('Room Blocking Flow', () => {
    it('should block and unblock a room', () => {
      const { result: authResult } = renderHook(() => useAuth(), {
        wrapper: AllProviders,
      })
      const { result: appResult } = renderHook(() => useApp(), {
        wrapper: AllProviders,
      })

      // Step 1: Login as supervisor
      act(() => {
        authResult.current.login('supervisor', 'admin')
      })

      // Step 2: Find an available room
      const availableRoom = appResult.current.rooms.find(r => r.status === 'disponivel')
      expect(availableRoom).toBeDefined()

      // Step 3: Block the room
      act(() => {
        appResult.current.updateRoom(availableRoom!.id, {
          status: 'bloqueado',
          blockReason: 'Manutenção preventiva',
          blockEndDate: '2026-05-15',
          blockResponsible: 'supervisor',
        })
      })

      // Step 4: Add audit log
      act(() => {
        appResult.current.addAuditEntry({
          user: 'supervisor',
          action: 'bloqueio-quarto',
          reference: `Quarto ${availableRoom!.number} - Manutenção preventiva`,
        })
      })

      // Verify blocked state
      let updatedRoom = appResult.current.rooms.find(r => r.id === availableRoom!.id)
      expect(updatedRoom?.status).toBe('bloqueado')
      expect(updatedRoom?.blockReason).toBe('Manutenção preventiva')

      // Step 5: Unblock the room
      act(() => {
        appResult.current.updateRoom(availableRoom!.id, {
          status: 'disponivel',
          blockReason: undefined,
          blockEndDate: undefined,
          blockResponsible: undefined,
        })
      })

      // Step 6: Add audit log
      act(() => {
        appResult.current.addAuditEntry({
          user: 'supervisor',
          action: 'desbloqueio-quarto',
          reference: `Quarto ${availableRoom!.number}`,
        })
      })

      // Verify unblocked state
      updatedRoom = appResult.current.rooms.find(r => r.id === availableRoom!.id)
      expect(updatedRoom?.status).toBe('disponivel')
      expect(updatedRoom?.blockReason).toBeUndefined()
    })
  })
})
