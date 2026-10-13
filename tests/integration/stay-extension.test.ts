import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { executeOperation } from "@/lib/server/operations";
import { serverQuote } from "@/lib/server/lodging-pricing";
import {
  getCollection,
  createCollectionItem,
} from "@/lib/server/db/relational-data-service";
import { extensionQuoteSignature } from "@/lib/stay-extension";
import { stayBalance, type Stay } from "@/lib/stays";
import { effectivePermissions } from "@/lib/permissions";
import { businessDay } from "@/lib/utils/business-values";
import type { Actor } from "@/lib/server/auth";
if (
  new URL(process.env.DATABASE_URL || "postgresql://localhost/invalid")
    .pathname !== "/erp_test"
)
  throw Error("Use erp_test isolado");
const prefix = "extension-" + randomUUID(),
  day = businessDay();
const date = (offset: number) =>
  new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10);
let admin: Actor, reception: Actor;
beforeAll(async () => {
  for (const profile of ["administrador", "recepcao"]) {
    const user = await prisma.user.create({
      data: {
        id: prefix + profile,
        username: prefix + profile,
        fullName: "Prorrogação",
        password: "not-used",
        createdBy: "test",
        role: "supervisor",
        accessProfile: profile,
      },
    });
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const actor: Actor = {
      id: user.id,
      username: user.username,
      role: "supervisor",
      sessionId: session.id,
      permissions: effectivePermissions(user),
      approvedUntil: null,
    };
    if (profile === "administrador") admin = actor;
    else reception = actor;
  }
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    "TRUNCATE customers, rooms, guest_profiles, transactions CASCADE",
  );
  await prisma.bankAccount.deleteMany();
  await prisma.user.update({
    where: { id: reception.id },
    data: { permissionOverrides: {} },
  });
  await prisma.room.createMany({
    data: [1, 2].map((id) => ({
      id,
      number: "EXT" + id,
      type: "casal",
      status: "disponivel",
      capacity: 2,
    })),
  });
  await createCollectionItem(
    "customers",
    {
      id: "ext-person",
      name: "Pessoa",
      cpfCnpj: "52998224725",
      active: true,
      roles: ["guest", "payer"],
    },
    admin,
  );
  await prisma.lodgingTariff.create({
    data: {
      id: "ext-rate",
      name: "Tarifa",
      roomType: "casal",
      minGuests: 1,
      maxGuests: 2,
      pricePerPerson: 100,
      validFrom: new Date(date(-30)),
    },
  });
  await prisma.bankAccount.create({
    data: {
      id: "ext-bank",
      name: "Banco",
      type: "corrente",
      active: true,
      initialBalance: 0,
      currentBalance: 0,
    },
  });
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});
const op = (
  kind: string,
  payload: unknown,
  actor = admin,
  request = randomUUID(),
) => executeOperation(actor, request, kind, payload);
const current = async () => (await getCollection("stays"))[0] as Stay;
async function start() {
  const payload = {
    roomId: 1,
    cpf: "52998224725",
    guestName: "Pessoa",
    guestCount: 2,
    checkIn: day,
    checkOut: date(2),
    totalValue: 400,
  };
  const r = (await op("reserve", payload)) as { id: string };
  await op("pay-reservation", {
    reservationId: r.id,
    value: 100,
    paymentMethod: "pix",
    accountId: "ext-bank",
  });
  await op("check-in", payload);
  return current();
}
async function extension(stay: Stay, out = date(4)) {
  const quote = await serverQuote(prisma, {
    roomId: stay.roomId,
    guestCount: stay.guestCount,
    checkIn: stay.checkOut,
    checkOut: out,
  });
  return {
    stayId: stay.id,
    recordVersion: stay.recordVersion,
    checkOut: out,
    reason: "Solicitação do hóspede",
    quotedTotal: quote.total,
    quoteSignature: extensionQuoteSignature(quote),
    confirmed: true,
  };
}
describe("Prorrogação transacional", () => {
  it("acrescenta somente novas noites, conserva desconto/sinal, período, conta e auditoria única", async () => {
    let stay = await start();
    await op("reservation-discount", {
      reservationId: stay.reservationId,
      type: "percent",
      value: 10,
    });
    stay = await current();
    const oldNights = stay.nightlyPrices,
      input = await extension(stay),
      request = randomUUID();
    await op("stay-extend", input, reception, request);
    await op("stay-extend", input, reception, request);
    const saved = await current();
    expect(saved.id).toBe(stay.id);
    expect(saved.recordVersion).toBe(stay.recordVersion + 1);
    expect(saved.nightlyPrices?.slice(0, 2)).toEqual(oldNights);
    expect(saved.lodgingValue).toBe(760);
    expect(stayBalance(saved)).toMatchObject({ paid: 100, balance: 660 });
    expect(saved.adjustments).toEqual(stay.adjustments);
    expect(saved.payments).toEqual(stay.payments);
    expect(saved.checkOut).toBe(date(4));
    expect(saved.allocations[0].end).toBe(date(4));
    const room = await prisma.room.findUniqueOrThrow({ where: { id: 1 } }),
      reservation = await prisma.reservation.findUniqueOrThrow({
        where: { id: stay.reservationId },
      });
    expect(room.checkOut?.toISOString().slice(0, 10)).toBe(date(4));
    expect(reservation.checkOut.toISOString().slice(0, 10)).toBe(date(4));
    expect(Number(reservation.paidValue)).toBe(100);
    expect(Number(reservation.originalValue)).toBe(800);
    await prisma.systemSettings.updateMany({data:{discountCeiling:5}});
    await expect(op("reservation-discount",{reservationId:stay.reservationId,type:"fixed",value:10},reception)).rejects.toMatchObject({status:403});
    expect(
      await prisma.auditEntry.count({
        where: { action: "Estadia prorrogada", entityId: stay.id },
      }),
    ).toBe(1);
    expect(
      await prisma.notificationEvent.count({
        where: { title: "Estadia prorrogada", reference: stay.id },
      }),
    ).toBe(1);
    expect(
      Number(
        (
          await prisma.bankAccount.findUniqueOrThrow({
            where: { id: "ext-bank" },
          })
        ).currentBalance,
      ),
    ).toBe(100);
  });
  it("rejeita reserva no período adicional e aceita limite de saída sem sobreposição", async () => {
    const stay = await start(),
      input = await extension(stay);
    const future = await prisma.reservation.create({
      data: {
        id: randomUUID(),
        roomId: 1,
        roomNumber: "EXT1",
        guestName: "Pessoa",
        cpf: "52998224725",
        status: "confirmada",
        checkIn: new Date(date(3)),
        checkOut: new Date(date(5)),
        totalValue: 200,
      },
    });
    await expect(op("stay-extend", input)).rejects.toMatchObject({
      status: 409,
    });
    expect((await current()).checkOut).toBe(date(2));
    await prisma.reservation.update({
      where: { id: future.id },
      data: { checkIn: new Date(date(4)) },
    });
    await op("stay-extend", input);
    expect((await current()).checkOut).toBe(date(4));
  });
  it("tarifa alterada, mesmo sem alterar seu valor, pede nova confirmação", async () => {
    const stay = await start(),
      input = await extension(stay);
    await prisma.lodgingTariff.update({
      where: { id: "ext-rate" },
      data: { recordVersion: { increment: 1 } },
    });
    await expect(op("stay-extend", input)).rejects.toThrow("tarifa");
    expect((await current()).lodgingValue).toBe(400);
    await op("stay-extend", await extension(stay));
    expect((await current()).lodgingValue).toBe(800);
  });
  it("duas sessões com a mesma versão produzem somente uma prorrogação", async () => {
    const stay = await start(),
      input = await extension(stay);
    const attempts = await Promise.allSettled([
      op("stay-extend", input),
      op("stay-extend", input),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect((await current()).nightlyPrices).toHaveLength(4);
    expect((await current()).lodgingValue).toBe(800);
  });
  it("depois da troca usa o quarto atual e preserva histórico do quarto anterior", async () => {
    let stay = await start();
    await op("stay-transfer", {
      stayId: stay.id,
      recordVersion: stay.recordVersion,
      roomId: 2,
      effectiveDate: day,
      reason: "Solicitação do hóspede",
    });
    stay = await current();
    await prisma.lodgingTariff.create({
      data: {
        id: "ext-specific",
        name: "Quarto atual",
        roomId: 2,
        roomType: "casal",
        minGuests: 1,
        maxGuests: 2,
        pricePerPerson: 150,
        validFrom: new Date(date(-30)),
      },
    });
    await op("stay-extend", await extension(stay, date(3)));
    const saved = await current();
    expect(saved.roomId).toBe(2);
    expect(saved.lodgingValue).toBe(700);
    expect(saved.allocations.find((a) => a.roomId === 1)?.end).toBe(day);
    expect(saved.allocations.find((a) => a.roomId === 2)?.end).toBe(date(3));
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: 1 } })).status,
    ).toBe("limpeza");
  });
  it("revogação impede novas operações e acesso ao recibo confirmado", async () => {
    const stay = await start(),
      input = await extension(stay),
      request = randomUUID();
    await op("stay-extend", input, reception, request);
    await prisma.user.update({
      where: { id: reception.id },
      data: { permissionOverrides: { "hospitality.extend": "deny" } },
    });
    await expect(
      op("stay-extend", input, reception, request),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      op("stay-extend", await extension(await current(), date(5)), reception),
    ).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({
      where: { id: reception.id },
      data: { permissionOverrides: { "stays.read": "deny" } },
    });
    await expect(
      op("stay-extend", input, reception, request),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("reserva concorrente e prorrogação não confirmam o mesmo quarto nas mesmas noites", async () => {
    const stay = await start(),
      input = await extension(stay);
    const attempts = await Promise.allSettled([
      op("stay-extend", input),
      op("reserve", {
        roomId: 1,
        cpf: "52998224725",
        guestName: "Pessoa",
        guestCount: 2,
        checkIn: date(2),
        checkOut: date(4),
        totalValue: 400,
      }),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const saved = await current(),
      bookings = await prisma.reservation.findMany({
        where: { roomId: 1, status: "confirmada" },
      });
    expect(
      saved.checkOut === date(4) ? bookings.length : bookings.length - 1,
    ).toBe(0);
  });
  it("não inventa ocupação legada; rejeita confirmação ausente, encurtamento e estadia encerrada", async () => {
    const stay = await start(),
      input = await extension(stay);
    await expect(
      op("stay-extend", { ...input, confirmed: false }),
    ).rejects.toThrow();
    await expect(
      op("stay-extend", { ...input, checkOut: stay.checkOut }),
    ).rejects.toMatchObject({ status: 400 });
    await prisma.stay.update({
      where: { id: stay.id },
      data: { guestCount: null },
    });
    await expect(
      op("stay-extend", {
        ...input,
        recordVersion: (await current()).recordVersion,
      }),
    ).rejects.toThrow("Regularize");
    await prisma.stay.update({
      where: { id: stay.id },
      data: { status: "closed" },
    });
    await expect(
      op("stay-extend", {
        ...input,
        recordVersion: (await current()).recordVersion,
      }),
    ).rejects.toThrow("encerrada");
  });
});
