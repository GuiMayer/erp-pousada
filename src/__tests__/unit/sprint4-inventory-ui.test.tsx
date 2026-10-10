import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseReceipt } from "@/components/stock/purchase-receipt";
import { InventoryPanels } from "@/components/stock/inventory-workspace";
import type { InventorySnapshot } from "@/lib/inventory";
const state = vi.hoisted(() => ({
  runOperation: vi.fn(),
  posProducts: [
    {
      id: "water",
      name: "Água",
      price: 8,
      unit: "un",
      active: true,
      trackStock: true,
      requiresExpiry: true,
      categoryId: "drinks",
    },
  ],
  productCategories: [{ id: "drinks", isRestaurant: false }],
  suppliers: [{ id: "supplier", name: "Distribuidora", active: true }],
  bankAccounts: [{ id: "bank", name: "Conta", active: true }],
  expenses: [],
  allowed: true,
}));
vi.mock("@/lib/app-context", () => ({ useApp: () => state }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ can: () => state.allowed }),
}));
const data = (): InventorySnapshot => ({
  lots: [
    {
      id: "lot",
      productId: "water",
      productName: "Água",
      unit: "un",
      code: "ABC",
      status: "active",
      expiresAt: "2099-01-01",
      quantity: 17,
      receivedQuantity: 20,
      remainingValue: 85,
      unitCost: 5,
      costEstimated: false,
      origin: "purchase",
      recordVersion: 2,
      receivedAt: "2026-10-10",
    },
  ],
  purchases: [],
  returns: [],
  inventories: [],
});
beforeEach(() => {
  state.runOperation.mockReset();
  state.allowed = true;
});
describe("Compras, lotes e contagem da Sprint 4", () => {
  it("mostra conversão, preserva rascunho em falha e envia uma única confirmação", async () => {
    state.runOperation.mockRejectedValue(Error("Fornecedor desativado"));
    const close = vi.fn();
    render(<PurchaseReceipt onClose={close} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Fornecedor"), {
      target: { value: "supplier" },
    });
    fireEvent.change(screen.getByLabelText("Bebida"), {
      target: { value: "water" },
    });
    fireEvent.change(screen.getByLabelText("Embalagens aceitas"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Custo por embalagem (R$)"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Lote no rótulo"), {
      target: { value: "ABC" },
    });
    fireEvent.input(screen.getByLabelText("Validade (obrigatória)"), {
      target: { value: "2099-01-01" },
    });
    expect(screen.getByText(/Entrada: 24 un/)).toBeInTheDocument();
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Confirmar recebimento e conta" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Fornecedor desativado",
      ),
    );
    expect(state.runOperation).toHaveBeenCalledTimes(1);
    expect(state.runOperation).toHaveBeenCalledWith(
      "purchase-receive",
      expect.objectContaining({
        supplierId: "supplier",
        items: [
          expect.objectContaining({
            acceptedPackages: 2,
            factor: 12,
            packagePrice: 60,
            code: "ABC",
            expiresAt: "2099-01-01",
          }),
        ],
      }),
    );
    expect(screen.getByLabelText("Embalagens aceitas")).toHaveValue(2);
    expect(close).not.toHaveBeenCalled();
  });
  it("contagem envia a quantidade no corte, sem sobrescrever o saldo atual", async () => {
    const snapshot = data();
    snapshot.inventories = [
      {
        id: "inv",
        recordVersion: 3,
        status: "open",
        capturedAt: "2026-10-10T12:00:00Z",
        postedAt: null,
        reason: "Contagem semanal",
        lines: [
          {
            id: "line",
            lotId: "lot",
            productName: "Água",
            expectedQuantity: 20,
            unitCost: 5,
            countedQuantity: null,
            delta: null,
          },
        ],
      },
    ];
    state.runOperation.mockResolvedValue({ success: true });
    render(
      <InventoryPanels
        section="inventory"
        data={snapshot}
        error=""
        loading={false}
        refresh={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Água · lote ABC"), {
      target: { value: "18" },
    });
    expect(
      screen.getByText(/No corte: 20 · atual: 17 · ajuste: -2/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar diferenças da contagem" }),
    );
    await waitFor(() =>
      expect(state.runOperation).toHaveBeenCalledWith("inventory-post", {
        inventoryId: "inv",
        recordVersion: 3,
        counts: [{ lotId: "lot", quantity: 18 }],
      }),
    );
  });
  it("lote vencido mantém físico, zera utilizável e mostra custo estimado", () => {
    const snapshot = data();
    snapshot.lots[0].expiresAt = "2000-01-01";
    snapshot.lots[0].costEstimated = true;
    render(
      <InventoryPanels
        section="lots"
        data={snapshot}
        error=""
        loading={false}
        refresh={vi.fn()}
      />,
    );
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("17 un")).toBeInTheDocument();
    expect(screen.getByText("0 un")).toBeInTheDocument();
    expect(screen.getAllByText(/estimado/)).toHaveLength(2);
  });
  it("consulta sem permissões não oferece confirmação ou mudança física", () => {
    state.allowed = false;
    render(
      <InventoryPanels
        section="lots"
        data={data()}
        error=""
        loading={false}
        refresh={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Registrar perda" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Registrar abertura física" }),
    ).not.toBeInTheDocument();
  });
});
