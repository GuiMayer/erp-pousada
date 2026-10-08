import type {
  AccountReceivable,
  AuditEntry,
  BankAccount,
  BankTransfer,
  Budget,
  CashClose,
  CostCenter,
  Customer,
  Employee,
  EmployeeConsumption,
  Expense,
  ExpenseCategory,
  GuestProfile,
  POSProduct,
  POSSale,
  ProductCategory,
  Production,
  Recipe,
  RecurringTransaction,
  Reservation,
  RestaurantOrder,
  RestaurantTable,
  Room,
  RoomConsumption,
  StockItem,
  StockMovement,
  Supplier,
  SystemSettings,
  Transaction,
  User,
  UserSession,
} from "@/lib/store"

type Row = Record<string, any>

export type DataCollectionKey =
  | "rooms"
  | "reservations"
  | "guests"
  | "expenses"
  | "transactions"
  | "auditLog"
  | "categories"
  | "cashCloses"
  | "consumptions"
  | "posProducts"
  | "posSales"
  | "productCategories"
  | "restaurantTables"
  | "restaurantOrders"
  | "stockItems"
  | "stockMovements"
  | "recipes"
  | "productions"
  | "employees"
  | "employeeConsumptions"
  | "users"
  | "userSessions"
  | "systemSettings"
  | "suppliers"
  | "customers"
  | "accountsReceivable"
  | "bankAccounts"
  | "bankTransfers"
  | "costCenters"
  | "budgets"
  | "recurringTransactions"

export type CollectionMapper<T = unknown> = {
  prismaModel: string
  include?: Record<string, unknown>
  orderBy?: unknown
  toApp(row: Row): T
  toCreate(item: T): Row
  toUpdate(item: Partial<T>): Row
}

const optional = <T>(value: T | null | undefined): T | undefined => value ?? undefined

const numberValue = (value: unknown): number => (value == null ? 0 : Number(value))
const optionalNumber = (value: unknown): number | undefined => (value == null ? undefined : Number(value))
const dateString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? "")
}
const dateOnly = (value: unknown): string => dateString(value).slice(0, 10)
const optionalDateOnly = (value: unknown): string | undefined => value == null ? undefined : dateOnly(value)
const optionalDateString = (value: unknown): string | undefined => (value == null ? undefined : dateString(value))
const dateValue = (value: unknown): Date | undefined => {
  if (!value) return undefined
  return value instanceof Date ? value : new Date(String(value))
}
const jsonValue = <T>(value: unknown, fallback: T): T => (value == null ? fallback : (value as T))

function stripUndefined(data: Row): Row {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
}

function nestedCreate<T>(items: T[] | undefined, mapper: (item: T, index: number) => Row): Row | undefined {
  if (!items) return undefined
  return { create: items.map(mapper) }
}

const roomMapper: CollectionMapper<Room> = {
  prismaModel: "room",
  orderBy: { number: "asc" },
  toApp: row => ({
    id: row.id,
    number: row.number,
    type: row.type,
    status: row.status,
    guest: optional(row.guest),
    guestCpf: optional(row.guestCpf),
    checkIn: optionalDateOnly(row.checkIn),
    checkOut: optionalDateOnly(row.checkOut),
    checkOutTime: optional(row.checkOutTime),
    blockReason: optional(row.blockReason),
    blockEndDate: optionalDateOnly(row.blockEndDate),
    blockResponsible: optional(row.blockResponsible),
    timeline: jsonValue(row.timeline, []),
  }),
  toCreate: item => stripUndefined({
    id: item.id,
    number: item.number,
    type: item.type,
    status: item.status,
    guest: item.guest,
    guestCpf: item.guestCpf,
    checkIn: dateValue(item.checkIn),
    checkOut: dateValue(item.checkOut),
    checkOutTime: item.checkOutTime,
    blockReason: item.blockReason,
    blockEndDate: dateValue(item.blockEndDate),
    blockResponsible: item.blockResponsible,
    timeline: item.timeline ?? [],
  }),
  toUpdate: item => stripUndefined({ ...roomMapper.toCreate(item as Room), timeline: item.timeline }),
}

const reservationMapper: CollectionMapper<Reservation> = {
  prismaModel: "reservation",
  orderBy: { checkIn: "asc" },
  toApp: row => ({
    recordVersion: row.recordVersion,
    id: row.id,
    roomId: row.roomId,
    roomNumber: row.roomNumber,
    guestName: row.guestName,
    cpf: row.cpf,
    checkIn: dateOnly(row.checkIn),
    checkOut: dateOnly(row.checkOut),
    status: row.status,
    totalValue: numberValue(row.totalValue),
    originalValue: optionalNumber(row.originalValue),
    cancellationFee: numberValue(row.cancellationFee ?? 0),
    paidValue: numberValue(row.paidValue ?? 0),
    cancelTreatment: optional(row.cancelTreatment),
  }),
  toCreate: item => stripUndefined({
    id: item.id,
    roomId: item.roomId,
    roomNumber: item.roomNumber,
    guestName: item.guestName,
    cpf: item.cpf,
    checkIn: dateValue(item.checkIn),
    checkOut: dateValue(item.checkOut),
    status: item.status,
    totalValue: item.totalValue,
    originalValue: item.originalValue,
    cancellationFee: item.cancellationFee,
    paidValue: item.paidValue,
    cancelTreatment: item.cancelTreatment,
  }),
  toUpdate: item => reservationMapper.toCreate(item as Reservation),
}

const guestMapper: CollectionMapper<GuestProfile> = {
  prismaModel: "guestProfile",
  orderBy: { name: "asc" },
  toApp: row => ({ cpf: row.cpf, name: row.name, creditValue: numberValue(row.creditValue ?? 0), totalStays: row.totalStays, avgTicket: numberValue(row.avgTicket), noShows: row.noShows }),
  toCreate: item => ({ cpf: item.cpf, name: item.name, creditValue: item.creditValue, totalStays: item.totalStays, avgTicket: item.avgTicket, noShows: item.noShows }),
  toUpdate: item => stripUndefined({ name: item.name, totalStays: item.totalStays, avgTicket: item.avgTicket, noShows: item.noShows }),
}

const expenseMapper: CollectionMapper<Expense> = {
  prismaModel: "expense",
  include: { installments: { orderBy: { installmentNumber: "asc" } } },
  orderBy: { dueDate: "asc" },
  toApp: row => ({
    id: row.id,
    description: row.description,
    category: row.category,
    supplierId: optional(row.supplierId),
    value: numberValue(row.value),
    dueDate: dateOnly(row.dueDate),
    paid: row.paid,
    paymentDate: optionalDateOnly(row.paymentDate),
    installments: row.installments?.map((item: Row) => ({
      id: item.id,
      installmentNumber: item.installmentNumber,
      value: numberValue(item.value),
      dueDate: dateOnly(item.dueDate),
      paid: item.paid,
      paymentDate: optionalDateOnly(item.paymentDate),
    })),
  }),
  toCreate: item => stripUndefined({
    id: item.id,
    description: item.description,
    category: item.category,
    supplierId: item.supplierId,
    value: item.value,
    dueDate: dateValue(item.dueDate),
    paid: item.paid,
    paymentDate: dateValue(item.paymentDate),
    installments: nestedCreate(item.installments, installment => ({
      id: installment.id,
      installmentNumber: installment.installmentNumber,
      value: installment.value,
      dueDate: dateValue(installment.dueDate),
      paid: installment.paid,
      paymentDate: dateValue(installment.paymentDate),
    })),
  }),
  toUpdate: item => stripUndefined({
    description: item.description,
    category: item.category,
    supplierId: item.supplierId,
    value: item.value,
    dueDate: dateValue(item.dueDate),
    paid: item.paid,
    paymentDate: dateValue(item.paymentDate),
  }),
}

const transactionMapper: CollectionMapper<Transaction> = {
  prismaModel: "transaction",
  orderBy: { date: "desc" },
  toApp: row => ({
    id: row.id,
    date: dateString(row.date),
    cashSessionId: optional(row.cashSessionId),
    description: row.description,
    value: numberValue(row.value),
    type: row.type,
    refId: optional(row.refId),
    category: optional(row.category),
    paymentMethod: optional(row.paymentMethod),
    responsible: optional(row.responsible),
    notes: optional(row.notes),
    accountId: optional(row.accountId),
    costCenterId: optional(row.costCenterId),
    taxAmount: optionalNumber(row.taxAmount),
    taxType: optional(row.taxType),
    grossAmount: optionalNumber(row.grossAmount),
  }),
  toCreate: item => stripUndefined({ ...item, date: dateValue(item.date) }),
  toUpdate: item => transactionMapper.toCreate(item as Transaction),
}

const auditMapper: CollectionMapper<AuditEntry> = {
  prismaModel: "auditEntry",
  orderBy: { date: "desc" },
  toApp: row => ({
    id: row.id,
    date: new Date(row.date).toISOString(),
    user: row.user,
    action: row.action,
    reference: row.reference,
    entityType: optional(row.entityType),
    entityId: optional(row.entityId),
    operation: optional(row.operation),
    metadata: optional(row.metadata),
  }),
  toCreate: item => stripUndefined({ ...item, date: dateValue(item.date) }),
  toUpdate: item => auditMapper.toCreate(item as AuditEntry),
}

const simpleMappers = {
  categories: {
    prismaModel: "expenseCategory",
    orderBy: { label: "asc" },
    toApp: (row: Row): ExpenseCategory => ({ id: row.id, label: row.label }),
    toCreate: (item: ExpenseCategory) => ({ id: item.id, label: item.label }),
    toUpdate: (item: Partial<ExpenseCategory>) => stripUndefined({ label: item.label }),
  },
  suppliers: {
    prismaModel: "supplier",
    orderBy: { name: "asc" },
    toApp: (row: Row): Supplier => ({ ...row } as Supplier),
    toCreate: (item: Supplier) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<Supplier>) => stripUndefined({ ...item }),
  },
  bankAccounts: {
    prismaModel: "bankAccount",
    orderBy: { name: "asc" },
    toApp: (row: Row): BankAccount => ({ ...row, initialBalance: numberValue(row.initialBalance), currentBalance: numberValue(row.currentBalance) } as BankAccount),
    toCreate: (item: BankAccount) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<BankAccount>) => stripUndefined({ ...item }),
  },
  costCenters: {
    prismaModel: "costCenter",
    orderBy: { name: "asc" },
    toApp: (row: Row): CostCenter => ({ ...row, description: optional(row.description) } as CostCenter),
    toCreate: (item: CostCenter) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<CostCenter>) => stripUndefined({ ...item }),
  },
  productCategories: {
    prismaModel: "productCategory",
    orderBy: { name: "asc" },
    toApp: (row: Row): ProductCategory => ({ ...row } as ProductCategory),
    toCreate: (item: ProductCategory) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<ProductCategory>) => stripUndefined({ ...item }),
  },
  posProducts: {
    prismaModel: "pOSProduct",
    orderBy: { name: "asc" },
    toApp: (row: Row): POSProduct => ({ ...row, price: numberValue(row.price), barcode: optional(row.barcode) } as POSProduct),
    toCreate: (item: POSProduct) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<POSProduct>) => stripUndefined({ ...item }),
  },
  restaurantTables: {
    prismaModel: "restaurantTable",
    orderBy: { number: "asc" },
    toApp: (row: Row): RestaurantTable => ({ ...row, currentOrderId: optional(row.currentOrderId), openedAt: optionalDateString(row.openedAt) } as RestaurantTable),
    toCreate: (item: RestaurantTable) => stripUndefined({ ...item, openedAt: dateValue(item.openedAt) }),
    toUpdate: (item: Partial<RestaurantTable>) => stripUndefined({ ...item, openedAt: dateValue(item.openedAt) }),
  },
  stockItems: {
    prismaModel: "stockItem",
    orderBy: { productName: "asc" },
    toApp: (row: Row): StockItem => ({ ...row, currentStock: numberValue(row.currentStock), minimumStock: numberValue(row.minimumStock), maximumStock: numberValue(row.maximumStock), averageCost: numberValue(row.averageCost), lastPurchasePrice: numberValue(row.lastPurchasePrice), lastPurchaseDate: optionalDateOnly(row.lastPurchaseDate) } as StockItem),
    toCreate: (item: StockItem) => stripUndefined({ ...item, lastPurchaseDate: dateValue(item.lastPurchaseDate) }),
    toUpdate: (item: Partial<StockItem>) => stripUndefined({ ...item, lastPurchaseDate: dateValue(item.lastPurchaseDate) }),
  },
  stockMovements: {
    prismaModel: "stockMovement",
    orderBy: { timestamp: "desc" },
    toApp: (row: Row): StockMovement => ({ ...row, quantity: numberValue(row.quantity), cost: optionalNumber(row.cost), timestamp: dateString(row.timestamp), expirationDate: optionalDateOnly(row.expirationDate) } as StockMovement),
    toCreate: (item: StockMovement) => stripUndefined({ ...item, timestamp: dateValue(item.timestamp), expirationDate: dateValue(item.expirationDate) }),
    toUpdate: (item: Partial<StockMovement>) => stripUndefined({ ...item, timestamp: dateValue(item.timestamp), expirationDate: dateValue(item.expirationDate) }),
  },
  employees: {
    prismaModel: "employee",
    orderBy: { name: "asc" },
    toApp: (row: Row): Employee => ({ ...row, consumptionLimit: numberValue(row.consumptionLimit), mealBenefit: jsonValue(row.mealBenefit, { lunchIncluded: false, dinnerIncluded: false, snackIncluded: false }) } as Employee),
    toCreate: (item: Employee) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<Employee>) => stripUndefined({ ...item }),
  },
  users: {
    prismaModel: "user",
    orderBy: { username: "asc" },
    toApp: (row: Row): User => ({ ...Object.fromEntries(Object.entries(row).filter(([key]) => key !== "password")), email: optional(row.email), createdAt: dateString(row.createdAt), lastLogin: optionalDateString(row.lastLogin) } as User),
    toCreate: (item: User) => stripUndefined({ ...item, createdAt: dateValue(item.createdAt), lastLogin: dateValue(item.lastLogin) }),
    toUpdate: (item: Partial<User>) => stripUndefined({ ...item, createdAt: dateValue(item.createdAt), lastLogin: dateValue(item.lastLogin) }),
  },
  userSessions: {
    prismaModel: "userSession",
    orderBy: { loginTime: "desc" },
    toApp: (row: Row): UserSession => ({ ...row, loginTime: dateString(row.loginTime), logoutTime: optionalDateString(row.logoutTime) } as UserSession),
    toCreate: (item: UserSession) => stripUndefined({ ...item, loginTime: dateValue(item.loginTime), logoutTime: dateValue(item.logoutTime) }),
    toUpdate: (item: Partial<UserSession>) => stripUndefined({ ...item, loginTime: dateValue(item.loginTime), logoutTime: dateValue(item.logoutTime) }),
  },
  systemSettings: {
    prismaModel: "systemSettings",
    toApp: (row: Row): SystemSettings => ({ ...row } as SystemSettings),
    toCreate: (item: SystemSettings) => stripUndefined({ ...item }),
    toUpdate: (item: Partial<SystemSettings>) => stripUndefined({ ...item }),
  },
} satisfies Partial<Record<DataCollectionKey, CollectionMapper<any>>>

const customerMapper: CollectionMapper<Customer> = {
  prismaModel: "customer",
  orderBy: { name: "asc" },
  toApp: row => ({ ...row, birthDate: optionalDateString(row.birthDate), createdAt: dateString(row.createdAt), updatedAt: dateString(row.updatedAt) } as Customer),
  toCreate: item => stripUndefined({ ...item, birthDate: dateValue(item.birthDate), createdAt: dateValue(item.createdAt), updatedAt: dateValue(item.updatedAt) }),
  toUpdate: item => stripUndefined({ ...item, birthDate: dateValue(item.birthDate), createdAt: dateValue(item.createdAt), updatedAt: dateValue(item.updatedAt) }),
}

const cashCloseMapper: CollectionMapper<CashClose> = {
  prismaModel: "cashClose",
  orderBy: { date: "desc" },
  toApp: row => ({
    responsibleUserId: optional(row.responsibleUserId), ...row, date: dateString(row.date), openedAt: optionalDateString(row.openedAt), closedAt: optionalDateString(row.closedAt), openingValue: numberValue(row.openingValue), physicalValue: numberValue(row.physicalValue), expectedValue: numberValue(row.expectedValue), divergence: numberValue(row.divergence) } as CashClose),
  toCreate: item => stripUndefined({ ...item, date: dateValue(item.date), openedAt: dateValue(item.openedAt), closedAt: dateValue(item.closedAt) }),
  toUpdate: item => cashCloseMapper.toCreate(item as CashClose),
}

const roomConsumptionMapper: CollectionMapper<RoomConsumption> = {
  prismaModel: "roomConsumption",
  include: { items: true },
  orderBy: { roomId: "asc" },
  toApp: row => ({ roomId: row.roomId, items: row.items?.map((item: Row) => ({ id: item.id, label: item.label, unitPrice: numberValue(item.unitPrice), quantity: item.quantity })) ?? [] }),
  toCreate: item => ({ id: `room-${item.roomId}`, roomId: item.roomId, items: nestedCreate(item.items, entry => ({ id: entry.id, label: entry.label, unitPrice: entry.unitPrice, quantity: entry.quantity })) }),
  toUpdate: item => stripUndefined({ roomId: item.roomId }),
}

const accountReceivableMapper: CollectionMapper<AccountReceivable> = {
  prismaModel: "accountReceivable",
  include: { installments: { orderBy: { installmentNumber: "asc" } } },
  orderBy: { dueDate: "asc" },
  toApp: row => ({
    ...row,
    value: numberValue(row.value),
    issueDate: dateString(row.issueDate),
    dueDate: dateOnly(row.dueDate),
    paymentDate: optionalDateOnly(row.paymentDate),
    installments: row.installments?.map((item: Row) => ({ id: item.id, installmentNumber: item.installmentNumber, value: numberValue(item.value), dueDate: dateOnly(item.dueDate), status: item.status, paymentDate: optionalDateOnly(item.paymentDate) })),
  } as AccountReceivable),
  toCreate: item => stripUndefined({
    ...item,
    issueDate: dateValue(item.issueDate),
    dueDate: dateValue(item.dueDate),
    paymentDate: dateValue(item.paymentDate),
    installments: nestedCreate(item.installments, installment => ({ id: installment.id, installmentNumber: installment.installmentNumber, value: installment.value, dueDate: dateValue(installment.dueDate), status: installment.status, paymentDate: dateValue(installment.paymentDate) })),
  }),
  toUpdate: item => stripUndefined({ ...item, issueDate: dateValue(item.issueDate), dueDate: dateValue(item.dueDate), paymentDate: dateValue(item.paymentDate), installments: undefined }),
}

const bankTransferMapper: CollectionMapper<BankTransfer> = {
  prismaModel: "bankTransfer",
  orderBy: { date: "desc" },
  toApp: row => ({ ...row, date: dateOnly(row.date), value: numberValue(row.value) } as BankTransfer),
  toCreate: item => stripUndefined({ ...item, date: dateValue(item.date) }),
  toUpdate: item => bankTransferMapper.toCreate(item as BankTransfer),
}

const budgetMapper: CollectionMapper<Budget> = {
  prismaModel: "budget",
  include: { categories: true },
  orderBy: [{ year: "desc" }, { month: "desc" }],
  toApp: row => ({
    id: row.id,
    name: row.name,
    year: row.year,
    month: optional(row.month),
    status: row.status,
    categories: row.categories?.map((item: Row) => ({ categoryId: item.categoryId, categoryName: item.categoryName, plannedAmount: numberValue(item.plannedAmount), spentAmount: numberValue(item.spentAmount), variance: numberValue(item.variance), variancePercent: numberValue(item.variancePercent) })) ?? [],
  }),
  toCreate: item => stripUndefined({
    id: item.id,
    name: item.name,
    year: item.year,
    month: item.month,
    status: item.status,
    categories: nestedCreate(item.categories, (category, index) => ({ id: `${item.id}-${category.categoryId || index}`, ...category })),
  }),
  toUpdate: item => stripUndefined({ name: item.name, year: item.year, month: item.month, status: item.status }),
}

const recurringTransactionMapper: CollectionMapper<RecurringTransaction> = {
  prismaModel: "recurringTransaction",
  orderBy: { startDate: "desc" },
  toApp: row => ({ ...row, value: numberValue(row.value), startDate: dateOnly(row.startDate), endDate: optionalDateOnly(row.endDate), lastGenerated: optionalDateString(row.lastGenerated) } as RecurringTransaction),
  toCreate: item => stripUndefined({ ...item, startDate: dateValue(item.startDate), endDate: dateValue(item.endDate), lastGenerated: dateValue(item.lastGenerated) }),
  toUpdate: item => recurringTransactionMapper.toCreate(item as RecurringTransaction),
}

const posSaleMapper: CollectionMapper<POSSale> = {
  prismaModel: "pOSSale",
  include: { items: { include: { product: true } } },
  orderBy: { date: "desc" },
  toApp: row => ({
    ...row,
    date: dateOnly(row.date),
    subtotal: numberValue(row.subtotal),
    discount: numberValue(row.discount),
    total: numberValue(row.total),
    amountPaid: numberValue(row.amountPaid),
    change: numberValue(row.change),
    customer: optional(row.customer),
    cancelReason: optional(row.cancelReason),
    items: row.items?.map((item: Row) => ({ id: item.id, product: { ...simpleMappers.posProducts.toApp(item.product), price: numberValue(item.unitPrice) }, quantity: item.quantity, discount: numberValue(item.discount) })) ?? [],
  } as POSSale),
  toCreate: item => stripUndefined({
    id: item.id,
    date: dateValue(item.date),
    subtotal: item.subtotal,
    discount: item.discount,
    total: item.total,
    paymentMethod: item.paymentMethod,
    amountPaid: item.amountPaid,
    change: item.change,
    customer: item.customer,
    operator: item.operator,
    status: item.status,
    cancelReason: item.cancelReason,
    items: nestedCreate(item.items, cartItem => ({ id: cartItem.id, productId: cartItem.product.id, quantity: cartItem.quantity, discount: cartItem.discount, unitPrice: cartItem.product.price, subtotal: cartItem.product.price * cartItem.quantity * (1 - cartItem.discount / 100) })),
  }),
  toUpdate: item => stripUndefined({ status: item.status, cancelReason: item.cancelReason }),
}

const restaurantOrderMapper: CollectionMapper<RestaurantOrder> = {
  prismaModel: "restaurantOrder",
  include: { items: true },
  orderBy: { openedAt: "desc" },
  toApp: row => ({
    ...row,
    subtotal: numberValue(row.subtotal),
    discount: numberValue(row.discount),
    total: numberValue(row.total),
    openedAt: dateString(row.openedAt),
    closedAt: optionalDateString(row.closedAt),
    amountPaid: optionalNumber(row.amountPaid),
    change: optionalNumber(row.change),
    items: row.items?.map((item: Row) => ({ ...item, unitPrice: numberValue(item.unitPrice), subtotal: numberValue(item.subtotal) })) ?? [],
  } as RestaurantOrder),
  toCreate: item => stripUndefined({
    ...item,
    openedAt: dateValue(item.openedAt),
    closedAt: dateValue(item.closedAt),
    items: nestedCreate(item.items, orderItem => ({ id: orderItem.id, productId: orderItem.productId, productName: orderItem.productName, quantity: orderItem.quantity, unitPrice: orderItem.unitPrice, subtotal: orderItem.subtotal, category: orderItem.category })),
  }),
  toUpdate: item => stripUndefined({ ...item, openedAt: dateValue(item.openedAt), closedAt: dateValue(item.closedAt), items: undefined }),
}

const recipeMapper: CollectionMapper<Recipe> = {
  prismaModel: "recipe",
  include: { ingredients: true },
  orderBy: { name: "asc" },
  toApp: row => ({
    ...row,
    expectedYield: numberValue(row.expectedYield),
    createdAt: dateString(row.createdAt),
    updatedAt: dateString(row.updatedAt),
    ingredients: row.ingredients?.map((item: Row) => ({ productId: item.productId, productName: item.productName, quantity: numberValue(item.quantity), unit: item.unit, cost: numberValue(item.cost) })) ?? [],
  } as Recipe),
  toCreate: item => stripUndefined({
    ...item,
    createdAt: dateValue(item.createdAt),
    updatedAt: dateValue(item.updatedAt),
    ingredients: nestedCreate(item.ingredients, (ingredient, index) => ({ id: `${item.id}-${ingredient.productId || index}`, ...ingredient })),
  }),
  toUpdate: item => stripUndefined({ ...item, createdAt: dateValue(item.createdAt), updatedAt: dateValue(item.updatedAt), ingredients: undefined }),
}

const productionMapper: CollectionMapper<Production> = {
  prismaModel: "production",
  orderBy: { timestamp: "desc" },
  toApp: row => ({ ...row, plannedQuantity: numberValue(row.plannedQuantity), producedQuantity: numberValue(row.producedQuantity), yield: numberValue(row.yield), totalCost: numberValue(row.totalCost), unitCost: numberValue(row.unitCost), timestamp: dateString(row.timestamp), notes: optional(row.notes) } as Production),
  toCreate: item => stripUndefined({ ...item, timestamp: dateValue(item.timestamp) }),
  toUpdate: item => productionMapper.toCreate(item as Production),
}

const employeeConsumptionMapper: CollectionMapper<EmployeeConsumption> = {
  prismaModel: "employeeConsumption",
  include: { items: true },
  orderBy: { timestamp: "desc" },
  toApp: row => ({
    ...row,
    total: numberValue(row.total),
    timestamp: dateString(row.timestamp),
    items: row.items?.map((item: Row) => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: numberValue(item.unitPrice), subtotal: numberValue(item.subtotal) })) ?? [],
  } as EmployeeConsumption),
  toCreate: item => stripUndefined({
    ...item,
    timestamp: dateValue(item.timestamp),
    items: nestedCreate(item.items, (entry, index) => ({ id: `${item.id}-${entry.productId || index}`, ...entry })),
  }),
  toUpdate: item => stripUndefined({ ...item, timestamp: dateValue(item.timestamp), items: undefined }),
}

export const collectionMappers = {
  rooms: roomMapper,
  reservations: reservationMapper,
  guests: guestMapper,
  expenses: expenseMapper,
  transactions: transactionMapper,
  auditLog: auditMapper,
  categories: simpleMappers.categories,
  cashCloses: cashCloseMapper,
  consumptions: roomConsumptionMapper,
  posProducts: simpleMappers.posProducts,
  posSales: posSaleMapper,
  productCategories: simpleMappers.productCategories,
  restaurantTables: simpleMappers.restaurantTables,
  restaurantOrders: restaurantOrderMapper,
  stockItems: simpleMappers.stockItems,
  stockMovements: simpleMappers.stockMovements,
  recipes: recipeMapper,
  productions: productionMapper,
  employees: simpleMappers.employees,
  employeeConsumptions: employeeConsumptionMapper,
  users: simpleMappers.users,
  userSessions: simpleMappers.userSessions,
  systemSettings: simpleMappers.systemSettings,
  suppliers: simpleMappers.suppliers,
  customers: customerMapper,
  accountsReceivable: accountReceivableMapper,
  bankAccounts: simpleMappers.bankAccounts,
  bankTransfers: bankTransferMapper,
  costCenters: simpleMappers.costCenters,
  budgets: budgetMapper,
  recurringTransactions: recurringTransactionMapper,
} satisfies Record<DataCollectionKey, CollectionMapper<any>>

export function getCollectionMapper(key: string): CollectionMapper | null {
  return collectionMappers[key as DataCollectionKey] ?? null
}

export function getCollectionKeys(): DataCollectionKey[] {
  return Object.keys(collectionMappers) as DataCollectionKey[]
}
