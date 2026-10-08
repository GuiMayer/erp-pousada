import { prisma } from "../lib/db/client"
import bcrypt from "bcryptjs"
import { assertDemoTarget } from "../lib/server/demo-guard"
import { ALL_PERMISSIONS } from "../lib/permissions"
import type { Actor } from "../lib/server/auth"
import { applyOperation } from "../lib/server/operations"
import { evaluateStock, evaluateTimed } from "../lib/server/notifications/rules"
import { businessDay } from "../lib/utils/business-values"

async function main() {
  assertDemoTarget(process.env.DATABASE_URL, process.env.DEMO_MODE)
  const password = process.env.DEMO_LOGIN_PASSWORD
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error("Defina a senha exclusiva de demonstração (12 a 72 bytes)")
  if (await prisma.user.count() || await prisma.room.count()) throw new Error("Banco de demonstração não está vazio; encerre e inicie pelo guia")
  const hash = await bcrypt.hash(password, 12)
  const today = businessDay()
  const day = (offset: number) => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
  const actor: Actor = { id: "demo-admin", username: "demo", role: "supervisor", sessionId: "seed", approvedUntil: null, permissions: ALL_PERMISSIONS }
  await prisma.$transaction(async tx => {
    for (const [username, profile, fullName] of [["demo", "administrador", "Administrador de demonstração"], ["recepcao", "recepcao", "Recepção de demonstração"], ["restaurante", "restaurante", "Restaurante de demonstração"], ["estoque", "estoque", "Estoque de demonstração"]]) {
      await tx.user.create({ data: { id: username === "demo" ? actor.id : `demo-${username}`, username, password: hash, fullName, role: username === "demo" ? "supervisor" : "operador", accessProfile: profile, createdBy: "demo-seed" } })
    }
    await tx.systemSettings.create({ data: { id: "demo-settings", pousadaName: "Pousada Jardim · Demonstração", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 10 } })
    for (let id = 1; id <= 12; id++) await tx.room.create({ data: { id, number: String(100 + id), type: id <= 5 ? "casal" : id <= 9 ? "triplo" : "suite", status: id === 10 ? "limpeza" : id === 11 ? "bloqueado" : "disponivel", ...(id === 11 ? { blockReason: "Manutenção de exemplo", blockEndDate: new Date(day(2)), blockResponsible: "Equipe de demonstração" } : {}) } })
    await tx.bankAccount.create({ data: { id: "demo-bank", name: "Conta de exemplo", type: "corrente", initialBalance: 8000, currentBalance: 8000 } })
    await tx.costCenter.create({ data: { id: "demo-center", name: "Hospedagem", description: "Centro de custo fictício" } })
    for (const [id, label] of [["demo-cat-receita", "Hospedagem"], ["demo-cat-despesa", "Manutenção"], ["demo-cat-compras", "Compras"]]) await tx.expenseCategory.create({ data: { id, label } })
    for (const [id, name, icon] of [["demo-beverages", "Bebidas", "Coffee"], ["demo-food", "Refeições", "UtensilsCrossed"], ["demo-ingredients", "Ingredientes", "Wheat"]]) await tx.productCategory.create({ data: { id, name, icon, color: "#3a7d5c", isRestaurant: id !== "demo-ingredients" } })
    const products = [
      { id: "demo-water", name: "Água mineral", categoryId: "demo-beverages", price: 5, stock: 75, unit: "un", minimum: 15, cost: 2 },
      { id: "demo-coffee", name: "Café espresso", categoryId: "demo-beverages", price: 7, stock: 80, unit: "un", minimum: 10, cost: 2 },
      { id: "demo-juice", name: "Suco natural", categoryId: "demo-beverages", price: 12, stock: 3, unit: "un", minimum: 10, cost: 4 },
      { id: "demo-soda", name: "Refrigerante", categoryId: "demo-beverages", price: 8, stock: 0, unit: "un", minimum: 12, cost: 3 },
      { id: "demo-lunch", name: "Prato executivo", categoryId: "demo-food", price: 35, stock: 60, unit: "un", minimum: 10, cost: 12 },
      { id: "demo-sandwich", name: "Sanduíche artesanal", categoryId: "demo-food", price: 22, stock: 40, unit: "un", minimum: 8, cost: 8 },
      { id: "demo-flour", name: "Farinha de trigo", categoryId: "demo-ingredients", price: 8, stock: 20, unit: "kg", minimum: 5, cost: 4 },
    ]
    for (const product of products) {
      await tx.pOSProduct.create({ data: { id: product.id, name: product.name, categoryId: product.categoryId, price: product.price, trackStock: true } })
      await tx.stockItem.create({ data: { id: `stock-${product.id}`, productId: product.id, productName: product.name, currentStock: product.stock, minimumStock: product.minimum, maximumStock: 150, unit: product.unit, averageCost: product.cost, lastPurchasePrice: product.cost } })
    }
    // Standard public test CPF examples, associated only with fictitious guest names.
    const guests = [["52998224725", "Hóspede Exemplo 1"], ["11144477735", "Hóspede Exemplo 2"], ["39053344705", "Hóspede Exemplo 3"]]
    for (let index = 0; index < guests.length; index++) {
      const [cpf, guestName] = guests[index]
      const input = { roomId: index + 1, cpf, guestName, checkIn: day(-2), checkOut: day(index === 0 ? 0 : 2), totalValue: 900 + index * 150 }
      const reservation = await applyOperation(tx, actor, "reserve", input) as { id: string }
      await applyOperation(tx, actor, "check-in", input)
      await applyOperation(tx, actor, "pay-reservation", { reservationId: reservation.id, value: index === 0 ? 450 : input.totalValue, paymentMethod: "pix", accountId: "demo-bank" })
    }
    await applyOperation(tx, actor, "reserve", { roomId: 5, cpf: guests[0][0], guestName: guests[0][1], checkIn: day(0), checkOut: day(3), totalValue: 1200 })
    await applyOperation(tx, actor, "reserve", { roomId: 6, cpf: guests[1][0], guestName: guests[1][1], checkIn: day(2), checkOut: day(5), totalValue: 1050 })
    await applyOperation(tx, actor, "add-consumption", { roomId: 1, item: { id: "demo-consumption-item", label: "Água mineral", quantity: 2, unitPrice: 5 } })
    await applyOperation(tx, actor, "cash-open", { openingValue: 200 })
    for (let index = 0; index < 14; index++) {
      const product = products[index % 2 === 0 ? 0 : 4], quantity = index % 3 + 1, total = product.price * quantity, saleId = `demo-sale-${index}`
      await applyOperation(tx, actor, "sale", { sale: { id: saleId, items: [{ id: `item-${saleId}`, product: { id: product.id }, quantity, discount: 0 }], total, paymentMethod: "pix", accountId: "demo-bank", amountPaid: total, customer: "Cliente fictício" }, globalDiscount: 0 })
      const date = new Date(`${day(-(index % 7))}T15:00:00Z`)
      await tx.pOSSale.update({ where: { id: saleId }, data: { date } })
      await tx.transaction.updateMany({ where: { refId: `Venda ${saleId}` }, data: { date } })
    }
    for (let id = 1; id <= 6; id++) await tx.restaurantTable.create({ data: { id, number: String(id).padStart(2, "0"), capacity: id <= 3 ? 2 : 4, status: id === 2 ? "reservada" : "livre" } })
    await applyOperation(tx, actor, "open-table", { tableId: 1, orderId: "demo-order" })
    await applyOperation(tx, actor, "edit-order", { orderId: "demo-order", expectedVersion: 0, items: [{ id: "demo-order-food", productId: "demo-lunch", quantity: 2 }, { id: "demo-order-drink", productId: "demo-water", quantity: 2 }], discountPercent: 0 })
    const openedAt = new Date(Date.now() - 3 * 3600000)
    await tx.restaurantOrder.update({ where: { id: "demo-order" }, data: { openedAt } })
    await tx.restaurantTable.update({ where: { id: 1 }, data: { openedAt } })
    await tx.recipe.create({ data: { id: "demo-recipe", name: "Pães do café da manhã", category: "Padaria", version: 1, expectedYield: 20, yieldUnit: "un", preparationTime: 60, instructions: "Receita ilustrativa para explorar o cadastro e a produção.", ingredients: { create: [{ id: "demo-recipe-flour", productId: "demo-flour", productName: "Farinha de trigo", quantity: 1, unit: "kg", cost: 4 }] } } })
    await applyOperation(tx, actor, "production", { recipeId: "demo-recipe", plannedQuantity: 1, producedQuantity: 20, notes: "Lote fictício de demonstração" })
    await tx.employee.create({ data: { id: "demo-employee", name: "Funcionário Exemplo", cpf: "39053344705", role: "atendimento", consumptionLimit: 150, mealBenefit: { lunchIncluded: true, dinnerIncluded: false, snackIncluded: true } } })
    await tx.customer.create({ data: { id: "demo-customer", name: "Cliente Exemplo", cpfCnpj: "52998224725", notes: "Cadastro fictício de demonstração" } })
    await tx.accountReceivable.create({ data: { id: "demo-receivable", customerId: "demo-customer", customerName: "Cliente Exemplo", description: "Evento de exemplo", value: 600, issueDate: new Date(day(-7)), dueDate: new Date(day(-2)), status: "pendente" } })
    for (const [id, description, value, offset] of [["demo-expense-1", "Material de limpeza (exemplo)", 280, 3], ["demo-expense-2", "Manutenção preventiva (exemplo)", 450, -1]] as const) await tx.expense.create({ data: { id, description, value, category: "Manutenção", dueDate: new Date(day(offset)) } })
    await evaluateStock(tx); await evaluateTimed(tx)
  }, { timeout: 60000 })
  console.log("Demonstração criada: dados fictícios, permissões reais e alterações temporárias.")
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha no seed de demonstração"); process.exitCode = 1 }).finally(() => prisma.$disconnect())
