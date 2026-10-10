"use client";
import { useState, type FormEvent } from "react";
import { useInventory } from "@/lib/hooks/useInventory";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { getDataConfig } from "@/lib/data/config";
import { businessDay } from "@/lib/utils/business-values";
import {
  lotUsable,
  type LotView,
  type InventorySnapshot,
  type ReturnView,
} from "@/lib/inventory";
import { formatCurrency } from "@/lib/utils/formatters";
import type { PaymentLine } from "@/lib/payments";
import { PaymentEditor } from "@/components/payment-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PurchaseReceipt } from "./purchase-receipt";
const fieldClass = "mt-1 min-h-11 w-full rounded-md border bg-background px-2";
export function InventoryWorkspace({
  section,
}: {
  section: "purchases" | "lots" | "inventory";
}) {
  const connected = getDataConfig().adapter === "database",
    read = useInventory(connected);
  if (!connected)
    return (
      <p className="rounded-md border p-4 text-sm">
        Compras, lotes e inventário precisam do banco de dados. Use a
        demonstração pelo painel para testar estes fluxos com exemplos, sem
        afetar a operação.
      </p>
    );
  return (
    <InventoryPanels
      section={section}
      data={read.data}
      error={read.error}
      loading={read.loading}
      refresh={read.refresh}
    />
  );
}
export function InventoryPanels({
  section,
  data,
  error,
  loading,
  refresh,
}: {
  section: "purchases" | "lots" | "inventory";
  data: InventorySnapshot;
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
}) {
  const { can } = useAuth(),
    { runOperation, posProducts, expenses = [], bankAccounts = [] } = useApp(),
    [receiptOpen, setReceiptOpen] = useState(false),
    [lotAction, setLotAction] = useState<{
      kind: "stock-opening" | "lot-review" | "stock-loss" | "purchase-return";
      lot?: LotView;
    } | null>(null),
    [settlement, setSettlement] = useState<ReturnView | null>(null),
    [supplierFilter, setSupplierFilter] = useState(""),
    [lotFilter, setLotFilter] = useState("all"),
    [counts, setCounts] = useState<Record<string, string>>({}),
    [inventoryReason, setInventoryReason] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState("");
  const today = businessDay(),
    open = data.inventories.find((i) => i.status === "open");
  async function act(kind: string, payload: unknown) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await runOperation(kind, payload);
      setNotice("Operação confirmada.");
      await refresh();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const usable = (l: LotView) =>
    lotUsable(
      l,
      today,
      !!posProducts.find((p) => p.id === l.productId)?.requiresExpiry,
    );
  const visibleLots = data.lots.filter(
    (l) =>
      l.quantity > 0 &&
      (lotFilter === "all" ||
        (lotFilter === "usable" && usable(l)) ||
        (lotFilter === "review" && l.status === "unverified") ||
        (lotFilter === "unusable" && !usable(l))),
  );
  const purchases = data.purchases
    .filter((p) => !supplierFilter || p.supplierId === supplierFilter)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const suppliers = [
    ...new Map(
      data.purchases.map((p) => [p.supplierId, p.supplierName]),
    ).entries(),
  ];
  if (loading) return <p role="status">Carregando documentos de estoque…</p>;
  return (
    <div className="space-y-4 [&_[data-slot=label]]:flex-col [&_[data-slot=label]]:items-stretch">
      {error && (
        <div role="alert" className="rounded border p-3 text-destructive">
          {error}
          <Button variant="outline" onClick={() => void refresh()}>
            Tentar atualizar
          </Button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {section === "purchases" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Compras e fornecedores</h3>
              <p className="text-sm text-muted-foreground">
                Recebimento confirmado, custo e obrigação vinculada.
              </p>
            </div>
            {can("purchases.receive") && (
              <Button onClick={() => setReceiptOpen(true)}>
                Receber compra
              </Button>
            )}
          </div>
          <Label>
            Histórico por fornecedor
            <select
              className={fieldClass}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">Todos os fornecedores</option>
              {suppliers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Label>
          {!purchases.length && (
            <p className="rounded border p-4 text-sm">
              Nenhuma compra recebida.
            </p>
          )}
          {purchases.map((p) => {
            const expense = expenses.find((e) => e.sourcePurchaseId === p.id),
              remaining = expense
                ? Math.max(0, expense.value - (expense.paidValue ?? 0))
                : 0;
            return (
              <details key={p.id} className="rounded-lg border bg-card p-4">
                <summary className="cursor-pointer">
                  <span className="font-medium">{p.supplierName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.receivedAt.slice(0, 10)} ·{" "}
                    {p.reference ?? "Sem referência"} ·{" "}
                    {formatCurrency(p.total)}
                  </span>
                  <span className="block text-sm">
                    {p.total === 0
                      ? "Sem obrigação financeira"
                      : !can("expenses.read")
                        ? "Conta registrada; consulta restrita"
                        : expense
                          ? `Pago: ${formatCurrency(expense.paidValue ?? 0)} · Em aberto: ${formatCurrency(remaining)}`
                          : "Conta não localizada; atualize a tela"}
                  </span>
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <p>
                    Mercadorias {formatCurrency(p.subtotal)} + frete{" "}
                    {formatCurrency(p.freight)} − desconto{" "}
                    {formatCurrency(p.discount)} = {formatCurrency(p.total)}
                  </p>
                  {p.items.map((item) => {
                    const lot = data.lots.find(
                      (l) => l.purchaseItemId === item.id,
                    );
                    return (
                      <div key={item.id} className="rounded bg-muted p-3">
                        <strong>{item.productName}</strong>
                        <p>
                          {item.acceptedPackages} {item.packaging} ×{" "}
                          {item.factor} = {item.quantity} {item.unit};
                          recusadas: {item.refusedPackages}
                        </p>
                        <p>
                          Custo recebido: {formatCurrency(item.totalCost)} ·
                          embalagem: {formatCurrency(item.packagePrice)}
                          {lot &&
                            ` · lote ${lot.code} · validade ${lot.expiresAt?.slice(0, 10) ?? "não informada"}`}
                        </p>
                      </div>
                    );
                  })}
                  {expense && (
                    <>
                      <p>
                        Vencimento: {expense.dueDate} · a conta fica disponível
                        em Financeiro → Despesas para pagamento.
                      </p>
                      {expense.installments?.map((part) => (
                        <p key={part.id}>
                          Parcela {part.installmentNumber}: {part.dueDate} ·
                          saldo{" "}
                          {formatCurrency(part.value - (part.paidValue ?? 0))}
                        </p>
                      ))}
                    </>
                  )}
                  {p.notes && <p>Observações: {p.notes}</p>}
                  <p>
                    Registrado por {p.registeredBy} · documento {p.id}
                  </p>
                </div>
              </details>
            );
          })}
          <h3 className="pt-2 text-lg font-semibold">Devoluções e acordos</h3>
          <p className="text-sm text-muted-foreground">
            A saída física não abate a dívida automaticamente. Registre aqui o
            acordo ou o reembolso realmente recebido.
          </p>
          {!data.returns.length && (
            <p className="text-sm">Nenhuma devolução registrada.</p>
          )}
          {data.returns.map((r) => {
            const lot = data.lots.find((l) => l.id === r.lotId);
            return (
              <div key={r.id} className="space-y-2 rounded-lg border p-4">
                <p className="font-medium">
                  {lot?.productName ?? "Bebida"} · lote {lot?.code ?? r.lotId}
                </p>
                <p className="text-sm">
                  {r.quantity} {lot?.unit} · custo baixado{" "}
                  {formatCurrency(r.stockValue)} · {r.reason}
                </p>
                <p className="text-sm">
                  {r.status === "pending"
                    ? "Acordo com fornecedor pendente"
                    : `${r.resolution === "discount" ? "Abatimento" : r.resolution === "refund" ? "Reembolso recebido" : "Sem acerto financeiro"} · ${formatCurrency(r.agreedValue ?? 0)} · ${r.settlementNote}`}
                </p>
                {r.status === "pending" && can("purchases.settleReturn") && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setSettlement(r)}
                  >
                    Registrar acordo
                  </Button>
                )}
              </div>
            );
          })}
        </>
      )}
      {section === "lots" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Lotes e validade</h3>
              <p className="text-sm text-muted-foreground">
                Referência de validade: {today}. Venda e consumo retiram
                primeiro do lote válido mais próximo do vencimento.
              </p>
            </div>
            {can("stock.opening") && (
              <Button
                variant="outline"
                onClick={() => setLotAction({ kind: "stock-opening" })}
              >
                Registrar abertura física
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border p-3">
              <p className="text-sm">Lotes com saldo físico</p>
              <strong className="text-2xl">
                {data.lots.filter((l) => l.quantity > 0).length}
              </strong>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm">Lotes indisponíveis</p>
              <strong className="text-2xl">
                {data.lots.filter((l) => l.quantity > 0 && !usable(l)).length}
              </strong>
            </div>
          </div>
          <Label>
            Exibir lotes
            <select
              className={fieldClass}
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
            >
              <option value="all">Todos com saldo</option>
              <option value="usable">Utilizáveis</option>
              <option value="unusable">
                Vencidos, bloqueados ou pendentes
              </option>
              <option value="review">Abertura pendente de revisão</option>
            </select>
          </Label>
          <p className="text-xs text-muted-foreground">
            Vencidos continuam no saldo físico até perda ou devolução
            autorizada. Custos antigos estimados são identificados.
          </p>
          {!visibleLots.length && (
            <p className="rounded border p-4 text-sm">
              Nenhum lote neste filtro.
            </p>
          )}
          {visibleLots
            .sort((a, b) =>
              (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"),
            )
            .map((l) => (
              <article
                key={l.id}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">
                    {l.productName} · {l.code}
                  </h4>
                  <Badge variant={usable(l) ? "secondary" : "destructive"}>
                    {l.status === "unverified"
                      ? "Revisar abertura"
                      : l.expiresAt && l.expiresAt.slice(0, 10) < today
                        ? "Vencido"
                        : l.status === "blocked"
                          ? "Bloqueado"
                          : usable(l)
                            ? "Utilizável"
                            : "Validade pendente"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>
                    Físico:{" "}
                    <strong>
                      {l.quantity} {l.unit}
                    </strong>
                  </p>
                  <p>
                    Utilizável:{" "}
                    <strong>
                      {usable(l) ? l.quantity : 0} {l.unit}
                    </strong>
                  </p>
                  <p>
                    Validade: {l.expiresAt?.slice(0, 10) ?? "não informada"}
                  </p>
                  <p>
                    Custo restante: {formatCurrency(l.remainingValue)}
                    {l.costEstimated ? " (estimado)" : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {l.origin === "purchase"
                    ? "Recebimento de fornecedor"
                    : l.origin === "legacy"
                      ? "Saldo legado"
                      : "Abertura"}{" "}
                  · {l.receivedAt.slice(0, 10)}
                  {l.reason && " · " + l.reason}
                </p>
                <div className="flex flex-wrap gap-2">
                  {can("stock.review") && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setLotAction({ kind: "lot-review", lot: l })
                      }
                    >
                      {l.status === "unverified"
                        ? "Revisar abertura"
                        : "Bloquear / liberar"}
                    </Button>
                  )}
                  {can("stock.loss") && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setLotAction({ kind: "stock-loss", lot: l })
                      }
                    >
                      Registrar perda
                    </Button>
                  )}
                  {l.purchaseItemId && can("purchases.return") && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        setLotAction({ kind: "purchase-return", lot: l })
                      }
                    >
                      Devolver ao fornecedor
                    </Button>
                  )}
                </div>
              </article>
            ))}
        </>
      )}
      {section === "inventory" && (
        <>
          <h3 className="text-xl font-semibold">Inventário por corte</h3>
          <p className="text-sm text-muted-foreground">
            Conte o saldo no momento do corte. O ajuste é a diferença entre
            contagem e saldo daquela hora; compras e saídas posteriores
            permanecem no estoque.
          </p>
          {open ? (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">
                Contagem aberta ·{" "}
                {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(open.capturedAt))}
              </h4>
              <p className="text-sm">{open.reason}</p>
              <p className="text-sm font-medium">
                Informe a quantidade física que havia no corte, por lote. Uma
                divergência que gere saldo negativo após movimentos posteriores
                será recusada.
              </p>
              {open.lines.map((line) => {
                const lot = data.lots.find((l) => l.id === line.lotId),
                  entered = counts[open.id + line.lotId];
                return (
                  <div key={line.id} className="space-y-2 rounded border p-3">
                    <Label>
                      {line.productName} · lote {lot?.code ?? line.lotId}
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Quantidade contada no corte"
                        value={entered ?? ""}
                        onChange={(e) =>
                          setCounts({
                            ...counts,
                            [open.id + line.lotId]: e.target.value,
                          })
                        }
                        disabled={!can("inventory.post") || busy}
                      />
                    </Label>
                    <p className="text-xs">
                      No corte: {line.expectedQuantity} · atual:{" "}
                      {lot?.quantity ?? 0}
                      {entered !== undefined && entered !== ""
                        ? ` · ajuste: ${Number((Number(entered) - line.expectedQuantity).toFixed(3))}`
                        : ""}
                    </p>
                  </div>
                );
              })}
              {can("inventory.post") && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={
                      busy ||
                      open.lines.some(
                        (l) =>
                          counts[open.id + l.lotId] === undefined ||
                          counts[open.id + l.lotId] === "",
                      )
                    }
                    onClick={() =>
                      void act("inventory-post", {
                        inventoryId: open.id,
                        recordVersion: open.recordVersion,
                        counts: open.lines.map((l) => ({
                          lotId: l.lotId,
                          quantity: Number(counts[open.id + l.lotId]),
                        })),
                      })
                    }
                  >
                    {busy ? "Confirmando…" : "Confirmar diferenças da contagem"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act("inventory-cancel", {
                        inventoryId: open.id,
                        recordVersion: open.recordVersion,
                        reason: "Contagem cancelada pelo responsável",
                      })
                    }
                  >
                    Cancelar contagem sem ajustar
                  </Button>
                </div>
              )}
              {!can("inventory.post") && (
                <p className="text-sm">
                  A confirmação da contagem é realizada pelo supervisor.
                </p>
              )}
            </div>
          ) : can("inventory.start") ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("inventory-start", { reason: inventoryReason });
              }}
              className="space-y-3 rounded border p-4"
            >
              <Label>
                Motivo / identificação da contagem
                <Input
                  required
                  minLength={5}
                  value={inventoryReason}
                  onChange={(e) => setInventoryReason(e.target.value)}
                  placeholder="Ex.: contagem semanal de bebidas"
                />
              </Label>
              <Button disabled={busy}>Criar corte e iniciar contagem</Button>
            </form>
          ) : (
            <p>Não há contagem aberta.</p>
          )}
          <h4 className="font-medium">Histórico de contagens</h4>
          {data.inventories
            .filter((i) => i.status !== "open")
            .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
            .map((i) => (
              <details key={i.id} className="rounded border p-3">
                <summary>
                  {i.capturedAt.slice(0, 10)} ·{" "}
                  {i.status === "posted" ? "Confirmado" : "Cancelado"} ·{" "}
                  {i.reason}
                </summary>
                <div className="mt-2 space-y-1 text-sm">
                  {i.lines.map((l) => (
                    <p key={l.id}>
                      {l.productName} ·{" "}
                      {data.lots.find((lot) => lot.id === l.lotId)?.code} ·
                      corte {l.expectedQuantity} · contado{" "}
                      {l.countedQuantity ?? "—"} · diferença {l.delta ?? "—"}
                    </p>
                  ))}
                </div>
              </details>
            ))}
        </>
      )}
      {receiptOpen && (
        <PurchaseReceipt
          onClose={() => setReceiptOpen(false)}
          onSaved={() => void refresh()}
        />
      )}{" "}
      {lotAction && (
        <LotAction
          kind={lotAction.kind}
          lot={lotAction.lot}
          onClose={() => setLotAction(null)}
          act={act}
          busy={busy}
          error={actionError}
        />
      )}{" "}
      {settlement && (
        <Settlement
          returned={settlement}
          data={data}
          onClose={() => setSettlement(null)}
          act={act}
          busy={busy}
          error={actionError}
          accounts={bankAccounts.filter((a) => a.active)}
        />
      )}
    </div>
  );
}
function LotAction({
  kind,
  lot,
  onClose,
  act,
  busy,
  error,
}: {
  kind: string;
  lot?: LotView;
  onClose: () => void;
  act: (kind: string, payload: unknown) => Promise<boolean | undefined>;
  busy: boolean;
  error: string;
}) {
  const { posProducts, productCategories } = useApp(),
    [productId, setProduct] = useState(""),
    [quantity, setQuantity] = useState(""),
    [cost, setCost] = useState(""),
    [code, setCode] = useState(lot?.code ?? ""),
    [expiry, setExpiry] = useState(lot?.expiresAt?.slice(0, 10) ?? ""),
    [status, setStatus] = useState(
      lot?.status === "blocked" ? "blocked" : "active",
    ),
    [reason, setReason] = useState(""),
    opening = kind === "stock-opening",
    review = kind === "lot-review",
    title = opening
      ? "Registrar abertura física"
      : review
        ? "Revisar ou bloquear lote"
        : kind === "stock-loss"
          ? "Registrar perda física"
          : "Devolver mercadoria ao fornecedor";
  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = opening
      ? {
          productId,
          quantity: Number(quantity),
          totalCost: Number(cost),
          code,
          expiresAt: expiry || undefined,
          reason,
        }
      : review
        ? {
            lotId: lot!.id,
            recordVersion: lot!.recordVersion,
            code,
            expiresAt: expiry || undefined,
            status,
            reason,
          }
        : {
            lotId: lot!.id,
            recordVersion: lot!.recordVersion,
            quantity: Number(quantity),
            reason,
          };
    if (await act(kind, payload)) onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        mobileTask
        protectDraft
        aria-describedby={undefined}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 [&_[data-slot=label]]:flex-col [&_[data-slot=label]]:items-stretch"
          onSubmit={submit}
        >
          {lot && (
            <p>
              {lot.productName} · {lot.code} · físico {lot.quantity} {lot.unit}
            </p>
          )}
          {opening && (
            <>
              <p className="text-sm">
                Somente mercadoria já existente na pousada. Compras de
                fornecedor usam o recebimento. Custo total é o valor de todas as
                unidades informadas.
              </p>
              <Label>
                Bebida
                <select
                  required
                  className={fieldClass}
                  value={productId}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {posProducts
                    .filter(
                      (p) =>
                        p.active !== false &&
                        p.trackStock &&
                        productCategories.some(
                          (c) => c.id === p.categoryId && !c.isRestaurant,
                        ),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Label>
              <Label>
                Custo total do saldo (R$)
                <Input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </Label>
            </>
          )}
          {!review && (
            <Label>
              Quantidade na unidade base
              <Input
                required
                type="number"
                min="0.001"
                step="0.001"
                max={lot?.quantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Label>
          )}
          {(review || opening) && (
            <>
              <Label>
                Lote / identificação
                <Input
                  required
                  disabled={review && lot?.status !== "unverified"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Label>
              <Label>
                Validade real no rótulo
                <Input
                  type="date"
                  disabled={review && lot?.status !== "unverified"}
                  value={expiry}
                  onInput={(e) => setExpiry(e.currentTarget.value)}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </Label>
            </>
          )}
          {review && (
            <>
              <p className="text-sm">
                Esta revisão não altera a quantidade. Lote vencido continua
                indisponível mesmo se liberado. Para corrigir quantidade, faça
                inventário.
              </p>
              <Label>
                Condição
                <select
                  className={fieldClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Liberado após conferência</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </Label>
            </>
          )}
          {kind === "purchase-return" && (
            <p className="text-sm">
              Registra apenas a mercadoria devolvida. Combine e registre o
              abatimento ou reembolso separadamente, em Compras.
            </p>
          )}
          <Label>
            Motivo / evidência
            <Input
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button disabled={busy}>
              {busy ? "Confirmando…" : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Settlement({
  returned,
  data,
  onClose,
  act,
  busy,
  error,
  accounts,
}: {
  returned: ReturnView;
  data: InventorySnapshot;
  onClose: () => void;
  act: (kind: string, payload: unknown) => Promise<boolean | undefined>;
  busy: boolean;
  error: string;
  accounts: { id: string; name: string }[];
}) {
  const { expenses = [] } = useApp();
  const { can } = useAuth(),
    [resolution, setResolution] = useState("discount"),
    [value, setValue] = useState(String(returned.stockValue)),
    [part, setPart] = useState(""),
    [reason, setReason] = useState(""),
    [payments, setPayments] = useState<PaymentLine[]>([
      {
        method: "pix",
        value: returned.stockValue,
        accountId: accounts.length === 1 ? accounts[0].id : undefined,
      },
    ]),
    lot = data.lots.find((l) => l.id === returned.lotId),
    purchase = data.purchases.find((p) =>
      p.items.some((i) => i.id === lot?.purchaseItemId),
    ),
    expense = expenses.find((e) => e.sourcePurchaseId === purchase?.id);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await act("return-settle", {
        returnId: returned.id,
        recordVersion: returned.recordVersion,
        resolution,
        value: resolution === "none" ? 0 : Number(value),
        installmentId:
          resolution === "discount" ? part || undefined : undefined,
        reason,
        payments: resolution === "refund" ? payments : undefined,
      })
    )
      onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        mobileTask
        protectDraft
        aria-describedby={undefined}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Registrar acordo com fornecedor</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 [&_[data-slot=label]]:flex-col [&_[data-slot=label]]:items-stretch"
          onSubmit={submit}
        >
          <p className="text-sm">
            Custo devolvido: {formatCurrency(returned.stockValue)}. O acordo é
            independente da baixa física já registrada.
          </p>
          <Label>
            Acordo
            <select
              className={fieldClass}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="discount">Abater valor ainda a pagar</option>
              {can("expenses.pay") && (
                <option value="refund">Reembolso realmente recebido</option>
              )}
              <option value="none">Sem acerto financeiro</option>
            </select>
          </Label>
          {resolution !== "none" && (
            <Label>
              Valor acordado (R$)
              <Input
                required
                type="number"
                min="0.01"
                max={returned.stockValue}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Label>
          )}
          {resolution === "discount" && (
            <>
              <p className="text-sm">
                Saldo da compra:{" "}
                {expense
                  ? formatCurrency(expense.value - (expense.paidValue ?? 0))
                  : "consulta financeira restrita"}
              </p>
              {!!expense?.installments?.length && (
                <Label>
                  Parcela a abater
                  <select
                    required
                    className={fieldClass}
                    value={part}
                    onChange={(e) => setPart(e.target.value)}
                  >
                    <option value="">Selecione uma parcela</option>
                    {expense.installments
                      .filter((p) => p.value > (p.paidValue ?? 0))
                      .map((p) => (
                        <option value={p.id} key={p.id}>
                          Parcela {p.installmentNumber} · {p.dueDate} ·{" "}
                          {formatCurrency(p.value - (p.paidValue ?? 0))}
                        </option>
                      ))}
                  </select>
                </Label>
              )}
            </>
          )}
          {resolution === "refund" && (
            <PaymentEditor
              total={Number(value) || 0}
              lines={payments}
              onChange={setPayments}
            />
          )}
          <Label>
            Descrição do acordo
            <Input
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button disabled={busy}>
              {busy ? "Registrando…" : "Confirmar acordo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
