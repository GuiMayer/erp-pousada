"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import {
  initialRooms, initialReservations, initialGuests,
  initialExpenses, initialTransactions, initialAuditLog,
  initialCategories, initialCashCloses,
  type Room, type Reservation, type GuestProfile,
  type Expense, type Transaction, type AuditEntry,
  type ExpenseCategory, type CashClose, type RoomStatus,
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
  discountCeiling: number
  updateRoom: (id: number, data: Partial<Room>) => void
  addReservation: (r: Reservation) => void
  updateReservation: (id: string, data: Partial<Reservation>) => void
  addExpense: (e: Expense) => void
  addTransaction: (t: Transaction) => void
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "date">) => void
  addCategory: (label: string) => void
  addCashClose: (c: CashClose) => void
  findGuest: (cpf: string) => GuestProfile | undefined
  setDiscountCeiling: (v: number) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [guests] = useState<GuestProfile[]>(initialGuests)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(initialAuditLog)
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories)
  const [cashCloses, setCashCloses] = useState<CashClose[]>(initialCashCloses)
  const [discountCeiling, setDiscountCeiling] = useState(5)

  const updateRoom = useCallback((id: number, data: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
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

  return (
    <AppContext.Provider value={{
      rooms, reservations, guests, expenses, transactions,
      auditLog, categories, cashCloses, discountCeiling,
      updateRoom, addReservation, updateReservation,
      addExpense, addTransaction, addAuditEntry,
      addCategory, addCashClose, findGuest, setDiscountCeiling,
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
