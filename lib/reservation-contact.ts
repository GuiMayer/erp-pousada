import parsePhoneNumber from "libphonenumber-js/max"
import type { Customer, GuestProfile, Reservation } from "./store"
import { normalizeDocument } from "./utils/cpf-cnpj-validator"

/** Do not guess a foreign DDI, extract numbers from prose, or send extensions to WhatsApp. */
export function whatsappContact(raw?: string) {
  const value = raw?.trim()
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null
  const digits = value.replace(/\D/g, "")
  const international = value.startsWith("+") ? value : /^55\d{10,11}$/.test(digits) ? `+${digits}` : null
  if (!international && !/^\d{10,11}$/.test(digits)) return null
  const phone = parsePhoneNumber(international ?? value, { defaultCountry: international ? undefined : "BR", extract: false })
  if (!phone?.isValid() || phone.ext) return null
  return { number: phone.number, display: phone.formatInternational(), href: `https://wa.me/${phone.number.slice(1)}`, ddi: `+${phone.countryCallingCode}` }
}

/** The guest is the contact; the payer may be a different person or company. */
export function reservationPerson(reservation: Reservation, customers: Customer[], guests: GuestProfile[] = []) {
  const document = normalizeDocument(reservation.cpf)
  if (!document) return undefined
  const profile = guests.find(guest => normalizeDocument(guest.cpf) === document)
  return customers.find(person => person.id === profile?.customerId) ?? customers.find(person => normalizeDocument(person.cpfCnpj) === document)
}
