/**
 * Reservations Report Generator
 *
 * Generates PDF reports for reservations with filtering options.
 */

import type { Reservation, Room, SystemSettings } from "../store"
import {
  createPDFDocument,
  generatePDFHeader,
  addTableToPDF,
  addPDFFooter,
  formatCurrency,
  formatDate,
} from "../utils/pdf-export"

export interface ReservationReportFilters {
  startDate?: string
  endDate?: string
  status?: Reservation["status"] | "all"
  roomId?: number | "all"
}

export interface ReservationReportData {
  reservations: Reservation[]
  rooms: Room[]
  filters: ReservationReportFilters
}

/**
 * Gets the room name by ID
 */
function getRoomName(roomId: number, rooms: Room[]): string {
  const room = rooms.find(r => r.id === roomId)
  return room?.number || "Quarto não encontrado"
}

/**
 * Gets the status label in Portuguese
 */
function getStatusLabel(status: Reservation["status"]): string {
  const labels: Record<Reservation["status"], string> = {
    confirmada: "Confirmada",
    checkin: "Check-in",
    checkout: "Check-out",
    cancelada: "Cancelada",
    noshow: "Não compareceu",
  }
  return labels[status] || status
}

/**
 * Filters reservations based on the provided criteria
 */
function filterReservations(
  reservations: Reservation[],
  filters: ReservationReportFilters
): Reservation[] {
  return reservations.filter(reservation => {
    // Filter by date range
    if (filters.startDate) {
      const checkIn = new Date(reservation.checkIn)
      const filterStart = new Date(filters.startDate)
      if (checkIn < filterStart) return false
    }

    if (filters.endDate) {
      const checkOut = new Date(reservation.checkOut)
      const filterEnd = new Date(filters.endDate)
      if (checkOut > filterEnd) return false
    }

    // Filter by status
    if (filters.status && filters.status !== "all") {
      if (reservation.status !== filters.status) return false
    }

    // Filter by room
    if (filters.roomId && filters.roomId !== "all") {
      if (reservation.roomId !== filters.roomId) return false
    }

    return true
  })
}

/**
 * Generates a PDF report for reservations
 *
 * @param data - Report data including reservations, rooms, and filters
 * @param systemSettings - System settings for header information
 * @returns Blob containing the PDF file
 */
export function generateReservationsReport(
  data: ReservationReportData,
  systemSettings: SystemSettings
): Blob {
  const doc = createPDFDocument()

  // Generate header
  let yPos = generatePDFHeader(doc, systemSettings, "Relatório de Reservas")

  // Add filter information
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const filterLines: string[] = []

  if (data.filters.startDate || data.filters.endDate) {
    const start = data.filters.startDate ? formatDate(data.filters.startDate) : "Início"
    const end = data.filters.endDate ? formatDate(data.filters.endDate) : "Fim"
    filterLines.push(`Período: ${start} até ${end}`)
  }

  if (data.filters.status && data.filters.status !== "all") {
    filterLines.push(`Status: ${getStatusLabel(data.filters.status)}`)
  }

  if (data.filters.roomId && data.filters.roomId !== "all") {
    const roomName = getRoomName(data.filters.roomId, data.rooms)
    filterLines.push(`Quarto: ${roomName}`)
  }

  if (filterLines.length > 0) {
    doc.setTextColor(100, 100, 100)
    filterLines.forEach(line => {
      doc.text(line, 15, yPos)
      yPos += 5
    })
    yPos += 5
    doc.setTextColor(0, 0, 0)
  }

  // Filter reservations
  const filteredReservations = filterReservations(data.reservations, data.filters)

  // Sort by check-in date (most recent first)
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()
  })

  // Prepare table data
  const headers = ["Hóspede", "Quarto", "Check-in", "Check-out", "Status", "Total"]
  const rows = sortedReservations.map(reservation => [
    reservation.guestName,
    getRoomName(reservation.roomId, data.rooms),
    formatDate(reservation.checkIn),
    formatDate(reservation.checkOut),
    getStatusLabel(reservation.status),
    formatCurrency(reservation.totalValue),
  ])

  // Add table
  yPos = addTableToPDF(doc, headers, rows, yPos)

  // Add summary statistics
  yPos += 5
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Resumo", 15, yPos)
  yPos += 7

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")

  const totalReservations = sortedReservations.length
  const totalRevenue = sortedReservations.reduce((sum, r) => sum + r.totalValue, 0)

  const statusCounts: Record<string, number> = {}
  sortedReservations.forEach(r => {
    const label = getStatusLabel(r.status)
    statusCounts[label] = (statusCounts[label] || 0) + 1
  })

  doc.text(`Total de Reservas: ${totalReservations}`, 15, yPos)
  yPos += 5
  doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 15, yPos)
  yPos += 5

  if (totalReservations > 0) {
    doc.text(`Ticket Médio: ${formatCurrency(totalRevenue / totalReservations)}`, 15, yPos)
    yPos += 7

    doc.text("Distribuição por Status:", 15, yPos)
    yPos += 5

    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = ((count / totalReservations) * 100).toFixed(1)
      doc.text(`  ${status}: ${count} (${percentage}%)`, 15, yPos)
      yPos += 5
    })
  }

  // Add footer
  addPDFFooter(doc)

  // Generate blob
  const pdfBlob = doc.output("blob")
  return pdfBlob
}

/**
 * Downloads the reservations report as a PDF file
 *
 * @param data - Report data
 * @param systemSettings - System settings
 * @param filename - Optional custom filename (without extension)
 */
export function downloadReservationsReport(
  data: ReservationReportData,
  systemSettings: SystemSettings,
  filename?: string
): void {
  const blob = generateReservationsReport(data, systemSettings)

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split("T")[0]
  const defaultFilename = `relatorio-reservas-${timestamp}.pdf`
  const finalFilename = filename ? `${filename}.pdf` : defaultFilename

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = finalFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
