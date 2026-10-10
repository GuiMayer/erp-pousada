import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import { pousadaProducts, pousadaStock, isPousadaPermission } from "@/lib/pousada-scope"
import { categoryEnabled } from "@/lib/notification-policy"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/types/notifications"
import { evaluateStock, evaluateTimed } from "@/lib/server/notifications/rules"

describe("Pousada sem o módulo de restaurante", () => {
  const categories = [{ id: "bebidas", isRestaurant: false }, { id: "cozinha", isRestaurant: true }]
  const products = [
    { id: "agua", categoryId: "bebidas", barcode: "111" },
    { id: "prato", categoryId: "cozinha", barcode: "222" },
    { id: "legado", categoryId: "categoria-desconhecida", barcode: "333" },
  ]

  it("mantém a bebida e o legado, mas impede busca e código de barras do cardápio", () => {
    const catalog = pousadaProducts(products, categories)
    expect(catalog.map(product => product.id)).toEqual(["agua", "legado"])
    expect(catalog.find(product => product.barcode === "222")).toBeUndefined()
    expect(products).toHaveLength(3) // Preservation of stored records.
  })

  it("retira ingredientes dos saldos ativos sem excluir o estoque armazenado", () => {
    const stock = [{ productId: "agua" }, { productId: "prato" }, { productId: "legado" }]
    expect(pousadaStock(stock, products, categories)).toEqual([stock[0], stock[2]])
    expect(stock).toHaveLength(3)
  })

  it("mantém venda, consumo, caixa e usuários, sem permissões de cozinha na interface", () => {
    for (const permission of ["pos.sell", "stock.adjust", "consumptions.create", "cash.close", "users.create"]) expect(isPousadaPermission(permission)).toBe(true)
    for (const permission of ["restaurant.open", "recipes.read", "production.register", "productions.read", "employees.consume", "employeeConsumptions.read"]) expect(isPousadaPermission(permission)).toBe(false)
  })

  it("não conta alertas antigos de comandas ou produção mesmo com preferências habilitadas", () => {
    expect(categoryEnabled("restaurant", DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false)
    expect(categoryEnabled("production", DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false)
    expect(categoryEnabled("pos", DEFAULT_NOTIFICATION_PREFERENCES)).toBe(true)
    expect(categoryEnabled("cash", DEFAULT_NOTIFICATION_PREFERENCES)).toBe(true)
  })

  it("gera reposição somente para produtos ativos da pousada", async () => {
    const create = vi.fn(async ({ data }) => ({ id: "event", ...data }))
    const tx = {
      systemSettings: { findFirst: vi.fn().mockResolvedValue(null) },
      stockItem: { findMany: vi.fn().mockResolvedValue([
        { productId: "agua", productName: "Água", minimumStock: 10, currentStock: 0, product: { lots: [], trackStock: true, category: categories[0] } },
        { productId: "prato", productName: "Prato", minimumStock: 10, currentStock: 0, product: { lots: [], trackStock: true, category: categories[1] } },
      ]) },
      notificationEvent: { findUnique: vi.fn().mockResolvedValue(null), create, updateMany: vi.fn() },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    }
    await evaluateStock(tx as unknown as Prisma.TransactionClient)
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0][0].data.reference).toBe("agua")
    expect(tx.notificationEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conditionKey: { startsWith: "stock:", notIn: ["stock:agua"] } } }))
  })

  it("não consulta comandas no processamento periódico da pousada", async () => {
    const tx = {
      systemSettings: { findFirst: vi.fn().mockResolvedValue(null) },
      stockLot: {findMany:vi.fn().mockResolvedValue([])},
      reservation: { findMany: vi.fn().mockResolvedValue([]) },
      accountReceivable: { findMany: vi.fn().mockResolvedValue([]) },
      restaurantOrder: { findMany: vi.fn() },
      notificationEvent: { updateMany: vi.fn() },
    }
    await evaluateTimed(tx as unknown as Prisma.TransactionClient)
    expect(tx.restaurantOrder.findMany).not.toHaveBeenCalled()
  })
})
