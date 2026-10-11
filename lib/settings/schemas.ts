import { z } from 'zod'
import { cnpj } from 'cpf-cnpj-validator'
import { ruleSchema } from '@/lib/notification-policy'
import { GLOBAL_SECTIONS, type GlobalSectionId } from './sections'
const optionalText = z.string().trim().max(500).nullable().transform(value => value ?? '')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use um horário válido (HH:mm)')
export const SECTION_SCHEMAS = {
  pousada: z.object({ pousadaName: z.string().trim().min(3, 'Informe pelo menos três caracteres').max(200), contactPhone: optionalText, contactEmail: z.string().trim().max(200).refine(value => !value || z.string().email().safeParse(value).success, 'E-mail inválido'), address: optionalText, cnpj: z.string().trim().max(20).refine(value => !value || cnpj.isValid(value), 'CNPJ inválido'), razaoSocial: optionalText, inscricaoEstadual: optionalText, logoUrl: z.string().max(2000).refine(value => !value || /^https?:\/\//i.test(value) && z.string().url().safeParse(value).success, 'Use uma URL HTTP ou HTTPS') }).strict(),
  hospedagem: z.object({ checkInTime: time, checkOutTime: time }).strict(),
  comercial: z.object({ discountCeiling: z.number().finite().min(0).max(100) }).strict(),
  alertas: z.object({ notifyCheckInReminder: z.boolean(), notifyCheckOutReminder: z.boolean(), notifyLowStock: z.boolean(), notifyPendingPayments: z.boolean(), notificationRules: ruleSchema }).strict(),
}
export const settingsInput = z.object({ section: z.enum(['pousada', 'hospedagem', 'comercial', 'alertas']), recordVersion: z.number().int().nonnegative(), values: z.record(z.unknown()).optional() }).strict()
export function parseSettingsValues(section: GlobalSectionId, value: unknown) { return SECTION_SCHEMAS[section].parse(value) }
export function sectionPermission(section: GlobalSectionId, action: 'read' | 'edit') { return `settings.${GLOBAL_SECTIONS[section].permission}.${action}` }
