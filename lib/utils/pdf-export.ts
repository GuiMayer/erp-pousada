/**
 * PDF Export Utilities
 * 
 * Provides functions for generating PDF reports with jsPDF and jspdf-autotable.
 * All PDFs include a standard header with company information and logo.
 */

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { SystemSettings } from "../store"

/**
 * Formats a number as Brazilian currency (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/**
 * Formats a date to Brazilian format (DD/MM/YYYY)
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR").format(d)
}

/**
 * Formats a date and time to Brazilian format (DD/MM/YYYY HH:mm)
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d)
}

/**
 * Generates a standard PDF header with company information and logo
 * 
 * @param doc - jsPDF document instance
 * @param systemSettings - System settings with company information
 * @param reportTitle - Title of the report
 * @returns Y position after the header (for content placement)
 */
export function generatePDFHeader(
  doc: jsPDF,
  systemSettings: SystemSettings,
  reportTitle: string
): number {
  let yPos = 15

  // Add logo if available
  if (systemSettings.logoUrl && systemSettings.logoUrl.trim().length > 0) {
    try {
      // Logo will be added at top-left (15, 15) with max width of 40mm
      doc.addImage(systemSettings.logoUrl, "PNG", 15, yPos, 40, 20)
      yPos += 25
    } catch (error) {
      console.warn("Failed to add logo to PDF:", error)
      // Continue without logo
    }
  }

  // Company name
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(systemSettings.pousadaName, 15, yPos)
  yPos += 7

  // Fiscal information
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  
  if (systemSettings.razaoSocial && systemSettings.razaoSocial.trim().length > 0) {
    doc.text(`Razão Social: ${systemSettings.razaoSocial}`, 15, yPos)
    yPos += 5
  }

  if (systemSettings.cnpj && systemSettings.cnpj.trim().length > 0) {
    doc.text(`CNPJ: ${systemSettings.cnpj}`, 15, yPos)
    yPos += 5
  }

  if (systemSettings.inscricaoEstadual && systemSettings.inscricaoEstadual.trim().length > 0) {
    doc.text(`Inscrição Estadual: ${systemSettings.inscricaoEstadual}`, 15, yPos)
    yPos += 5
  }

  // Contact information
  if (systemSettings.address && systemSettings.address.trim().length > 0) {
    doc.text(systemSettings.address, 15, yPos)
    yPos += 5
  }

  const contactInfo: string[] = []
  if (systemSettings.contactPhone) contactInfo.push(systemSettings.contactPhone)
  if (systemSettings.contactEmail) contactInfo.push(systemSettings.contactEmail)
  
  if (contactInfo.length > 0) {
    doc.text(contactInfo.join(" | "), 15, yPos)
    yPos += 5
  }

  // Separator line
  yPos += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(15, yPos, 195, yPos)
  yPos += 8

  // Report title
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(reportTitle, 15, yPos)
  yPos += 10

  return yPos
}

/**
 * Adds a table to the PDF using jspdf-autotable
 * 
 * @param doc - jsPDF document instance
 * @param headers - Array of column headers
 * @param rows - Array of row data (each row is an array of cell values)
 * @param startY - Y position to start the table
 * @returns Y position after the table
 */
export function addTableToPDF(
  doc: jsPDF,
  headers: string[],
  rows: (string | number)[][],
  startY: number
): number {
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY,
    theme: "striped",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 15, right: 15 },
  })

  // Return the Y position after the table
  return (doc as any).lastAutoTable.finalY + 10
}

/**
 * Adds a footer with generation timestamp to the PDF
 * 
 * @param doc - jsPDF document instance
 */
export function addPDFFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages()
  
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(128, 128, 128)

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.height
    const footerText = `Gerado em: ${formatDateTime(new Date())} | Página ${i} de ${pageCount}`
    const textWidth = doc.getTextWidth(footerText)
    const xPos = (doc.internal.pageSize.width - textWidth) / 2
    doc.text(footerText, xPos, pageHeight - 10)
  }
}

/**
 * Creates a new PDF document with standard settings
 * 
 * @returns jsPDF document instance
 */
export function createPDFDocument(): jsPDF {
  return new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })
}
