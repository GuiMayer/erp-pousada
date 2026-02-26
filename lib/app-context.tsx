"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import {
  initialRooms, initialReservations, initialGuests,
  initialExpenses, initialTransactions, initialAuditLog,
  initialCategories, initialCashCloses,
  type Room, type Reservation, type GuestProfile,
  type Expense, type Transaction, type AuditEntry,
  type ExpenseCategory, type CashClose, type RoomStatus,
  type RoomConsumption, type ConsumptionItem,
} from "./store"

type AppContextType = {
  rooms: Room[]
  reservations: Reservation[]
  guests: GuestProfile[]
  expenses: Expense[]
  transactions: Transaction[]
  auditLog: AuditEntry[]
  categories: ExpenseCategory[]
  cashCloses: CashClose[]
  consumptions: RoomConsumption[]
  discountCeiling: number
  updateRoom: (id: number, data: Partial<Room>) => void
  addRoom: (room: Room) => void
  removeRoom: (id: number) => void
  addReservation: (r: Reservation) => void
  updateReservation: (id: string, data: Partial<Reservation>) => void
  addExpense: (e: Expense) => void
  updateExpense: (id: string, data: Partial<Expense>) => void
  addTransaction: (t: Transaction) => void
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "date">) => void
  addCategory: (label: string) => void
  addCashClose: (c: CashClose) => void
  findGuest: (cpf: string) => GuestProfile | undefined
  addGuest: (g: GuestProfile) => void
  setDiscountCeiling: (v: number) => void
  addConsumptionItem: (roomId: number, item: ConsumptionItem) => void
  removeConsumptionItem: (roomId: number, itemId: string) => void
  getConsumption: (roomId: number) => RoomConsumption | undefined
  clearConsumption: (roomId: number) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [guests, setGuests] = useState<GuestProfile[]>(initialGuests)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(initialAuditLog)
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories)
  const [cashCloses, setCashCloses] = useState<CashClose[]>(initialCashCloses)
  const [consumptions, setConsumptions] = useState<RoomConsumption[]>([])
  const [discountCeiling, setDiscountCeiling] = useState(5)

  const updateRoom = useCallback((id: number, data: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }, [])

  const addRoom = useCallback((room: Room) => {
    setRooms(prev => [...prev, room])
  }, [])

  const removeRoom = useCallback((id: number) => {
    setRooms(prev => prev.filter(r => r.id !== id))
  }, [])

  const addReservation = useCallback((r: Reservation) => {
    setReservations(prev => [...prev, r])
  }, [])

  const updateReservation = useCallback((id: string, data: Partial<Reservation>) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
  }, [])

  const addExpense = useCallback((e: Expense) => {
    setExpenses(prev => [...prev, e])
  }, [])

  const updateExpense = useCallback((id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }, [])

  const addTransaction = useCallback((t: Transaction) => {
    setTransactions(prev => [...prev, t])
  }, [])

  const addAuditEntry = useCallback((entry: Omit<AuditEntry, "id" | "date">) => {
    setAuditLog(prev => [{
      ...entry,
      id: `A${String(prev.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString(),
    }, ...prev])
  }, [])

  const addCategory = useCallback((label: string) => {
    setCategories(prev => [...prev, { id: `C${String(prev.length + 1).padStart(3, "0")}`, label }])
  }, [])

  const addCashClose = useCallback((c: CashClose) => {
    setCashCloses(prev => [...prev, c])
  }, [])

  const findGuest = useCallback((cpf: string) => {
    return guests.find(g => g.cpf === cpf)
  }, [guests])

  const addGuest = useCallback((g: GuestProfile) => {
    setGuests(prev => {
      const exists = prev.find(p => p.cpf === g.cpf)
      if (exists) return prev
      return [...prev, g]
    })
  }, [])

  const addConsumptionItem = useCallback((roomId: number, item: ConsumptionItem) => {
    setConsumptions(prev => {
      const existing = prev.find(c => c.roomId === roomId)
      if (existing) {
        return prev.map(c => c.roomId === roomId
          ? { ...c, items: [...c.items, item] }
          : c
        )
      }
      return [...prev, { roomId, items: [item] }]
    })
  }, [])

  const removeConsumptionItem = useCallback((roomId: number, itemId: string) => {
    setConsumptions(prev =>
      prev.map(c => c.roomId === roomId
        ? { ...c, items: c.items.filter(i => i.id !== itemId) }
        : c
      )
    )
  }, [])

  const getConsumption = useCallback((roomId: number) => {
    return consumptions.find(c => c.roomId === roomId)
  }, [consumptions])

  const clearConsumption = useCallback((roomId: number) => {
    setConsumptions(prev => prev.filter(c => c.roomId !== roomId))
  }, [])

  return (
    <AppContext.Provider value={{
      rooms, reservations, guests, expenses, transactions,
      auditLog, categories, cashCloses, consumptions, discountCeiling,
      updateRoom, addRoom, removeRoom,
      addReservation, updateReservation,
      addExpense, updateExpense, addTransaction, addAuditEntry,
      addCategory, addCashClose, findGuest, addGuest, setDiscountCeiling,
      addConsumptionItem, removeConsumptionItem, getConsumption, clearConsumption,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
