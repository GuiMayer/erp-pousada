export const collectionLabels: Record<string, string> = {
  rooms: "Quartos",
  reservations: "Reservas",
  guests: "Hóspedes",
  posProducts: "Produtos",
  productCategories: "Categorias de produto",
  posSales: "Vendas",
  restaurantTables: "Mesas",
  restaurantOrders: "Comandas",
  consumptions: "Consumos",
  stockItems: "Estoque",
  stockMovements: "Movimentos de estoque",
  recipes: "Receitas",
  productions: "Produção",
  expenses: "Despesas",
  transactions: "Lançamentos financeiros",
  cashCloses: "Turnos de caixa",
  bankAccounts: "Contas bancárias",
  bankTransfers: "Transferências",
  accountsReceivable: "Contas a receber",
  suppliers: "Fornecedores",
  customers: "Clientes",
  categories: "Categorias financeiras",
  costCenters: "Centros de custo",
  budgets: "Orçamentos",
  recurringTransactions: "Recorrências",
  employees: "Funcionários",
  employeeConsumptions: "Consumos de funcionários",
  users: "Usuários",
  userSessions: "Histórico de sessões",
  systemSettings: "Configurações",
  auditLog: "Auditoria"
}
export const operationPermissions: Record<string, string> = {
  reserve: "reservations.create",
  "reserve-group": "reservations.create",
  "edit-reservation": "reservations.edit",
  "check-in": "hospitality.checkin",
  "check-out": "hospitality.checkout",
  "release-room": "hospitality.release",
  "pay-reservation": "hospitality.receive",
  "cancel-reservation": "reservations.cancel",
  "reservation-discount": "reservations.discount",
  sale: "pos.sell",
  "cancel-sale": "pos.refund",
  "add-consumption": "consumptions.create",
  "remove-consumption": "consumptions.remove",
  "pay-consumption": "consumptions.receive",
  "open-table": "restaurant.open",
  "table-status": "restaurant.edit",
  "edit-order": "restaurant.edit",
  "close-order": "restaurant.receive",
  "cancel-order": "restaurant.cancel",
  "stock-movement": "stock.adjust",
  production: "production.register",
  "employee-consumption": "employees.consume",
  "pay-expense": "expenses.pay",
  "receive-account": "accountsReceivable.receive",
  "bank-transfer": "bankAccounts.transfer",
  "refund-transaction": "transactions.refund",
  "cash-open": "cash.open",
  "cash-close": "cash.close"
}
export const operationalCollections = ["reservations", "transactions", "cashCloses", "bankTransfers", "posSales", "restaurantOrders", "consumptions", "stockMovements", "productions", "employeeConsumptions"]
const actionLabels: Record<string, string> = {
  read: "Consultar",
  create: "Cadastrar",
  edit: "Editar",
  delete: "Excluir"
}
const specialLabels: Record<string, string> = {
  "bankAccounts.use": "Selecionar conta para pagamento (sem saldo)",
  "reservations.paidCancel": "Cancelar reserva paga",
  "users.manage": "Administrar acessos",
  "data.backup": "Exportar cópia completa",
  "data.restore": "Restaurar ou apagar dados",
  "approvals.issue": "Aprovar operações",
  "discount.override": "Desconto acima do teto",
  "cash.closeAny": "Fechar caixa de outro responsável",
  "reservations.feeCredit": "Definir multa e crédito",
  "consumptions.custom": "Lançar consumo personalizado",
  "hospitality.checkin": "Realizar check-in",
  "hospitality.checkout": "Realizar check-out",
  "hospitality.release": "Liberar quarto",
  "hospitality.receive": "Receber hospedagem",
  "reservations.cancel": "Cancelar reserva",
  "reservations.discount": "Aplicar desconto",
  "pos.sell": "Vender no PDV",
  "pos.refund": "Estornar venda",
  "consumptions.remove": "Remover consumo",
  "consumptions.receive": "Receber consumo",
  "restaurant.open": "Abrir comanda",
  "restaurant.edit": "Alterar comanda/mesa",
  "restaurant.receive": "Receber comanda",
  "restaurant.cancel": "Cancelar comanda",
  "stock.adjust": "Movimentar estoque",
  "production.register": "Registrar produção",
  "employees.consume": "Registrar consumo de funcionário",
  "expenses.pay": "Pagar despesa",
  "accountsReceivable.receive": "Receber título",
  "bankAccounts.transfer": "Transferir entre contas",
  "transactions.refund": "Estornar recebimento",
  "cash.open": "Abrir caixa",
  "cash.close": "Fechar próprio caixa"
}
export const PERMISSIONS = [...Object.entries(collectionLabels).flatMap(([key, label]) => Object.entries(actionLabels).filter(([action]) => action === "read" || ![...operationalCollections, "auditLog", "userSessions"].includes(key)).map(([action, title]) => ({ key: `${key}.${action}`, label: `${label} · ${title}` }))), ...Object.entries({ ...Object.fromEntries(Object.values(operationPermissions).map(key => [key, `${collectionLabels[key.split(".")[0]] ?? key} · ${actionLabels[key.split(".")[1]] ?? key}`])), ...specialLabels }).map(([key, label]) => ({ key, label }))].filter((item, index, items) => items.findIndex(other => other.key === item.key) === index)
export const ALL_PERMISSIONS = PERMISSIONS.map(permission => permission.key)
export const APPROVAL_PERMISSIONS = ["discount.override", "pos.refund", "restaurant.cancel", "consumptions.remove", "transactions.refund", "reservations.paidCancel"]
export type PermissionOverrides = Record<string, "allow" | "deny">
const reads = (...keys: string[]) => keys.map(key => `${key}.read`)
const crud = (...keys: string[]) => keys.flatMap(key => ["read", "create", "edit", "delete"].map(action => `${key}.${action}`))
const common = [...reads("systemSettings", "productCategories", "posProducts"), "bankAccounts.use"]
const daily = ["hospitality.checkin", "hospitality.checkout", "hospitality.release", "hospitality.receive", "reservations.create", "reservations.edit", "reservations.cancel", "reservations.discount", "pos.sell", "consumptions.create", "consumptions.receive", "restaurant.open", "restaurant.edit", "restaurant.receive", "cash.open", "cash.close"]
export const PROFILES: Record<string, { label: string; permissions: string[] }> = {
  personalizado: { label: "Personalizado (sem acessos iniciais)", permissions: [] },
  administrador: { label: "Administrador", permissions: ALL_PERMISSIONS },
  supervisor: { label: "Supervisor", permissions: ALL_PERMISSIONS.filter(key => !key.startsWith("users.") && !key.startsWith("userSessions.") && !key.startsWith("data.")) },
  recepcao: { label: "Recepção", permissions: [...common, ...reads("rooms", "reservations", "guests", "consumptions", "cashCloses"), ...crud("guests"), ...daily.filter(key => !key.startsWith("pos.") && !key.startsWith("restaurant."))] },
  caixa: { label: "Caixa", permissions: [...common, ...reads("posSales", "cashCloses", "customers"), ...crud("customers"), "pos.sell", "cash.open", "cash.close"] },
  restaurante: { label: "Restaurante", permissions: [...common, ...reads("restaurantTables", "restaurantOrders", "recipes"), "restaurant.open", "restaurant.edit", "restaurant.receive"] },
  estoque: { label: "Estoque", permissions: [...common, ...crud("stockItems", "recipes", "suppliers", "posProducts", "productCategories"), ...reads("stockMovements", "productions"), "stock.adjust", "production.register"] },
  operador_legado: { label: "Operador (acessos anteriores)", permissions: [...reads(...Object.keys(collectionLabels).filter(key => !["users", "userSessions", "employees", "employeeConsumptions"].includes(key))), ...crud("guests", "customers"), ...daily] },
}
export function effectivePermissions(user: { role?: string; accessProfile?: string | null; permissionOverrides?: unknown }): string[] {
  const profile = user.accessProfile || (user.role === "supervisor" ? "administrador" : "operador_legado")
  const permissions = new Set(PROFILES[profile]?.permissions ?? [])
  const overrides = user.permissionOverrides as PermissionOverrides | null
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) for (const [key, value] of Object.entries(overrides)) {
    if (!ALL_PERMISSIONS.includes(key)) continue
    if (value === "allow") permissions.add(key)
    if (value === "deny") permissions.delete(key)
  }
  return [...permissions].sort()
}
export const tabPermissions: Record<string, string[]> = {
  mapa: ["rooms.read"],
  reservas: ["reservations.read"],
  pdv: ["pos.sell"],
  estoque: ["stockItems.read"],
  financeiro: ["transactions.read",
  "expenses.read",
  "accountsReceivable.read",
  "cash.open",
  "cash.close", "bankAccounts.read"],
  relatorios: ["posSales.read"],
  configuracoes: ["systemSettings.edit"],
  administracao: ["users.manage", "systemSettings.edit"],
  auditoria: ["auditLog.read"]
}
