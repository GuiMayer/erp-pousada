import { randomUUID } from "node:crypto"
import { serverQuote } from "./lodging-pricing"
import { createCollectionItem } from "./db/relational-data-service"
import { prisma } from "@/lib/db/client"
import bcrypt from "bcryptjs"
import { assertDemoTarget } from "./demo-guard"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import type { Actor } from "./auth"
import { applyOperation } from "./operations"
import { evaluateStock, evaluateTimed } from "./notifications/rules"
import { businessDay } from "@/lib/utils/business-values"

export async function seedDemo() {
  assertDemoTarget(process.env.DATABASE_URL, process.env.DEMO_MODE)
  const password = process.env.DEMO_LOGIN_PASSWORD
  if (!password || (password.length < 12 && password !== "teste") || Buffer.byteLength(password) > 72) throw new Error("Defina a senha exclusiva de demonstração (12 a 72 bytes ou a senha de teste autorizada)")
  if (await prisma.user.count() || await prisma.room.count()) throw new Error("Banco de demonstração não está vazio; encerre e inicie pelo guia")
  const hash = await bcrypt.hash(password, 12)
  const today = businessDay()
  const day = (offset: number) => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
  const actor: Actor = { id: "demo-admin", username: "teste", role: "supervisor", sessionId: "seed", approvedUntil: null, permissions: ALL_PERMISSIONS }
  await prisma.$transaction(async tx => {
    for (const [username, profile, fullName] of [["teste", "administrador", "Administrador de demonstração"], ["recepcao", "recepcao", "Recepção de demonstração"], ["estoque", "estoque", "Estoque de demonstração"]]) {
      await tx.user.create({ data: { id: username === "teste" ? actor.id : `demo-${username}`, username, password: hash, fullName, role: username === "teste" ? "supervisor" : "operador", accessProfile: profile, createdBy: "demo-seed" } })
    }
    const seedSession = await tx.authSession.create({ data: { userId: actor.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) } })
    actor.sessionId = seedSession.id
    await tx.systemSettings.create({ data: { id: "demo-settings", pousadaName: "Pousada Jardim · Demonstração", checkInTime: "14:00", checkOutTime: "12:00", discountCeiling: 10 } })
    for (let id = 1; id <= 12; id++) await tx.room.create({ data: { id, number: String(100 + id), capacity: id <= 5 ? 2 : 3, type: id <= 5 ? "casal" : id <= 9 ? "triplo" : "suite", status: id === 10 ? "limpeza" : id === 11 ? "bloqueado" : "disponivel", ...(id === 11 ? { blockReason: "Manutenção de exemplo", blockEndDate: new Date(day(2)), blockResponsible: "Equipe de demonstração" } : {}) } })
    for (const roomType of ['casal', 'triplo', 'suite']) {
      await tx.lodgingTariff.create({ data: { id: 'demo-tariff-'+roomType+'-one', name: roomType+' · uma pessoa', roomType, minGuests: 1, maxGuests: 1, pricePerPerson: roomType === 'suite' ? 180 : 120, validFrom: new Date(day(-365)) } })
      await tx.lodgingTariff.create({ data: { id: 'demo-tariff-'+roomType+'-group', name: roomType+' · duas ou mais pessoas', roomType, minGuests: 2, maxGuests: 3, pricePerPerson: roomType === 'suite' ? 140 : 100, validFrom: new Date(day(-365)) } })
    }
    await createCollectionItem('customers', { id: 'demo-company', name: 'Empresa Horizonte · Exemplo', cpfCnpj: '12ABC34501DE35', roles: ['payer'], active: true }, actor, tx)
    await createCollectionItem('suppliers', { id: 'demo-supplier', name: 'Distribuidora · Exemplo', cnpj: '11222333000181', paymentTerms: '30 dias', active: true }, actor, tx)
    await tx.bankAccount.create({ data: { id: "demo-bank", name: "Conta de exemplo", type: "corrente", initialBalance: 8000, currentBalance: 8000 } })
    await tx.costCenter.create({ data: { id: "demo-center", name: "Hospedagem", description: "Centro de custo fictício" } })
    for (const [id, label] of [["demo-cat-receita", "Hospedagem"], ["demo-cat-despesa", "Manutenção"], ["demo-cat-compras", "Compras"]]) await tx.expenseCategory.create({ data: { id, label } })
    for (const [id, name, icon] of [["demo-beverages", "Bebidas", "Coffee"]]) await tx.productCategory.create({ data: { id, name, icon, color: "#3a7d5c", isRestaurant: id !== "demo-beverages" } })
    const products = [
      { id: "demo-water", name: "Água mineral", categoryId: "demo-beverages", price: 5, stock: 75, unit: "un", minimum: 15, cost: 2 },
      { id: "demo-coffee", name: "Café espresso", categoryId: "demo-beverages", price: 7, stock: 80, unit: "un", minimum: 10, cost: 2 },
      { id: "demo-juice", name: "Suco natural", categoryId: "demo-beverages", price: 12, stock: 3, unit: "un", minimum: 10, cost: 4 },
      { id: "demo-soda", name: "Refrigerante", categoryId: "demo-beverages", price: 8, stock: 0, unit: "un", minimum: 12, cost: 3 },
    ]
    for (const product of products) {
      await tx.pOSProduct.create({ data: { id: product.id, name: product.name, categoryId: product.categoryId, price: product.price, trackStock: true } })
      await tx.stockItem.create({ data: { id: `stock-${product.id}`, productId: product.id, productName: product.name, currentStock: product.stock, minimumStock: product.minimum, maximumStock: 150, unit: product.unit, averageCost: product.cost, lastPurchasePrice: product.cost } })
    }
    // Standard public test CPF examples, associated only with fictitious guest names.
    const guests = [["52998224725", "Hóspede Exemplo 1"], ["11144477735", "Hóspede Exemplo 2"], ["39053344705", "Hóspede Exemplo 3"]]
    for (let index = 0; index < guests.length; index++) {
      const [cpf, guestName] = guests[index]
      const input = { roomId: index + 1, cpf, guestName, guestCount: 2, checkIn: day(-2), checkOut: day(index === 0 ? 0 : 2), totalValue: 0 }
      input.totalValue = (await serverQuote(tx, { roomId: input.roomId, guestCount: 2, checkIn: input.checkIn, checkOut: input.checkOut })).total
      const reservation = await applyOperation(tx, actor, "reserve", input) as { id: string }
      await applyOperation(tx, actor, "check-in", input)
      await applyOperation(tx, actor, "pay-reservation", { reservationId: reservation.id, value: index === 0 ? 200 : input.totalValue, paymentMethod: "pix", accountId: "demo-bank" })
    }
    await applyOperation(tx, actor, "reserve", { roomId: 5, cpf: guests[0][0], guestName: guests[0][1], checkIn: day(0), checkOut: day(3), guestCount: 2, payerId: "demo-company", totalValue: 600 })
    await applyOperation(tx, actor, "reserve", { roomId: 6, cpf: guests[1][0], guestName: guests[1][1], checkIn: day(2), checkOut: day(5), guestCount: 2, totalValue: 600 })
    await applyOperation(tx, actor, "add-consumption", { roomId: 1, item: { id: "demo-consumption-item", label: "Água mineral", quantity: 2, unitPrice: 5 } })
    await applyOperation(tx, actor, "cash-open", { openingValue: 200 })
    for (let index = 0; index < 14; index++) {
      const product = products[index % 2 === 0 ? 0 : 1], quantity = index % 3 + 1, total = product.price * quantity, saleId = `demo-sale-${index}`
      await applyOperation(tx, actor, "sale", { sale: { id: saleId, items: [{ id: `item-${saleId}`, product: { id: product.id }, quantity, discount: 0 }], total, paymentMethod: "pix", accountId: "demo-bank", amountPaid: total, customer: "Cliente fictício" }, globalDiscount: 0 })
      const date = new Date(`${day(-(index % 7))}T15:00:00Z`)
      await tx.pOSSale.update({ where: { id: saleId }, data: { date } })
      await tx.transaction.updateMany({ where: { refId: `Venda ${saleId}` }, data: { date } })
    }
    const customer = await tx.customer.findFirstOrThrow({ where: { cpfCnpj: guests[0][0] } })
    await tx.accountReceivable.create({ data: { id: "demo-receivable", customerId: customer.id, customerName: customer.name, description: "Hospedagem de exemplo", value: 600, issueDate: new Date(day(-7)), dueDate: new Date(day(-2)), status: "pendente" } })
    for (const [id, description, value, offset] of [["demo-expense-1", "Material de limpeza (exemplo)", 280, 3], ["demo-expense-2", "Manutenção preventiva (exemplo)", 450, -1]] as const) await tx.expense.create({ data: { id, description, value, category: "Manutenção", dueDate: new Date(day(offset)) } })
    await evaluateStock(tx); await evaluateTimed(tx)
    await tx.authSession.delete({ where: { id: seedSession.id } })
  }, { timeout: 60000 })
  console.log("Demonstração criada: dados fictícios, permissões reais e alterações temporárias.")
}
