"use client";
import { useState, type FormEvent } from "react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { receiptTotals, type ReceiptLine } from "@/lib/inventory";
import { businessDay } from "@/lib/utils/business-values";
import type { PaymentLine } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils/formatters";
import { PaymentEditor } from "@/components/payment-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const selectClass = "mt-1 min-h-11 w-full rounded-md border bg-background px-2";
const newLine = (): ReceiptLine => ({
  productId: "",
  packaging: "Fardo",
  factor: 12,
  acceptedPackages: 1,
  refusedPackages: 0,
  packagePrice: 0,
  code: "",
});
export function PurchaseReceipt({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
      posProducts,
      productCategories,
      suppliers,
      runOperation,
      bankAccounts,
    } = useApp(),
    { can } = useAuth();
  const products = posProducts.filter(
      (p) =>
        p.active !== false &&
        p.trackStock &&
        productCategories.some((c) => c.id === p.categoryId && !c.isRestaurant),
    ),
    [supplierId, setSupplier] = useState(""),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [items, setItems] = useState<ReceiptLine[]>([newLine()]),
    [freight, setFreight] = useState(0),
    [discount, setDiscount] = useState(0),
    [dueDate, setDue] = useState(businessDay()),
    [payNow, setPayNow] = useState(false),
    [parts, setParts] = useState<{ value: number; dueDate: string }[]>([]),
    [payments, setPayments] = useState<PaymentLine[]>([
      {
        method: "pix",
        value: 0,
        accountId:
          bankAccounts.filter((a) => a.active).length === 1
            ? bankAccounts.filter((a) => a.active)[0].id
            : undefined,
      },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let totals: ReturnType<typeof receiptTotals> | null = null,
    calculationError = "";
  try {
    totals = receiptTotals(items, freight, discount);
  } catch (e) {
    calculationError = (e as Error).message;
  }
  const change = (index: number, patch: Partial<ReceiptLine>) =>
    setItems((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      items.some(
        (item) =>
          item.acceptedPackages > 0 &&
          products.find((p) => p.id === item.productId)?.requiresExpiry &&
          !item.expiresAt,
      )
    ) {
      setError("Informe a validade real de todos os lotes aceitos.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await runOperation("purchase-receive", {
        supplierId,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        items,
        freight,
        discount,
        dueDate,
        payNow,
        installments: parts.length ? parts : undefined,
        payments: payNow ? payments : undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
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
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>Receber compra de bebidas</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="space-y-5 [&_[data-slot=label]]:flex-col [&_[data-slot=label]]:items-stretch"
        >
          <p className="text-sm text-muted-foreground">
            Uma confirmação registra o recebimento, os lotes e a conta a pagar.
            Recusadas não entram no estoque nem na cobrança.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label>
              Fornecedor
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplier(e.target.value)}
                className={selectClass}
              >
                <option value="">Selecione um fornecedor cadastrado</option>
                {suppliers
                  .filter((s) => s.active)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Label>
            <Label>
              Referência do fornecedor
              <Input
                value={reference}
                maxLength={200}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Nota, recibo ou referência (opcional)"
              />
            </Label>
          </div>
          {items.map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            return (
              <fieldset key={index} className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">
                  Item {index + 1}
                </legend>
                <Label>
                  Bebida
                  <select
                    required
                    value={item.productId}
                    onChange={(e) =>
                      change(index, { productId: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="">Selecione</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · base {p.unit ?? "un"}
                      </option>
                    ))}
                  </select>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Label>
                    Embalagem
                    <Input
                      required
                      value={item.packaging}
                      onChange={(e) =>
                        change(index, { packaging: e.target.value })
                      }
                    />
                  </Label>
                  <Label>
                    Unidades base por embalagem
                    <Input
                      required
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.factor}
                      onChange={(e) =>
                        change(index, { factor: Number(e.target.value) })
                      }
                    />
                  </Label>
                  <Label>
                    Embalagens aceitas
                    <Input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={item.acceptedPackages}
                      onChange={(e) =>
                        change(index, {
                          acceptedPackages: Number(e.target.value),
                        })
                      }
                    />
                  </Label>
                  <Label>
                    Embalagens recusadas
                    <Input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={item.refusedPackages}
                      onChange={(e) =>
                        change(index, {
                          refusedPackages: Number(e.target.value),
                        })
                      }
                    />
                  </Label>
                  <Label>
                    Custo por embalagem (R$)
                    <Input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.packagePrice}
                      onChange={(e) =>
                        change(index, { packagePrice: Number(e.target.value) })
                      }
                    />
                  </Label>
                  <Label>
                    Lote no rótulo
                    <Input
                      required
                      value={item.code}
                      onChange={(e) => change(index, { code: e.target.value })}
                      placeholder="Lote real ou identificação interna"
                    />
                  </Label>
                  <Label>
                    Validade{" "}
                    {product?.requiresExpiry ? "(obrigatória)" : "(se houver)"}
                    <Input
                      type="date"
                      required={
                        !!product?.requiresExpiry && item.acceptedPackages > 0
                      }
                      value={item.expiresAt ?? ""}
                      onInput={(e) =>
                        change(index, {
                          expiresAt: e.currentTarget.value || undefined,
                        })
                      }
                      onChange={(e) =>
                        change(index, {
                          expiresAt: e.target.value || undefined,
                        })
                      }
                    />
                  </Label>
                </div>
                <p className="text-sm font-medium">
                  Entrada:{" "}
                  {totals?.lines[index].quantity ??
                    item.factor * item.acceptedPackages}{" "}
                  {product?.unit ?? "un"} · custo alocado:{" "}
                  {formatCurrency(totals?.lines[index].totalCost ?? 0)}
                </p>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    Remover item {index + 1}
                  </Button>
                )}
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="outline"
            disabled={items.length >= 100}
            onClick={() => setItems([...items, newLine()])}
          >
            Adicionar bebida / outro lote
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Label>
              Frete (R$)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={freight}
                onChange={(e) => setFreight(Number(e.target.value))}
              />
            </Label>
            <Label>
              Desconto (R$)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </Label>
          </div>
          <div className="rounded-md bg-muted p-3" role="status">
            {totals ? (
              <>
                Mercadorias: {formatCurrency(totals.subtotal)} · Total a pagar:{" "}
                <strong>{formatCurrency(totals.total)}</strong>
              </>
            ) : (
              calculationError
            )}
            <p className="text-xs mt-1">
              Frete e desconto integram o custo dos lotes. O preço de venda
              permanece o cadastrado.
            </p>
          </div>
          <Label>
            Vencimento da conta
            <Input
              required
              type="date"
              value={dueDate}
              onInput={(e) => setDue(e.currentTarget.value)}
              onChange={(e) => setDue(e.target.value)}
            />
          </Label>
          {can("expenses.pay") && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={payNow}
                onChange={(e) => {
                  setPayNow(e.target.checked);
                  if (e.target.checked) {
                    setParts([]);
                    setPayments(
                      payments.map((p, i) => ({
                        ...p,
                        value: i === 0 ? (totals?.total ?? 0) : 0,
                      })),
                    );
                  }
                }}
              />
              Pagar agora
            </label>
          )}
          {payNow ? (
            <PaymentEditor
              total={totals?.total ?? 0}
              lines={payments}
              onChange={setPayments}
            />
          ) : (
            <div className="space-y-3">
              {parts.map((part, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 gap-3 rounded border p-3"
                >
                  <Label>
                    Parcela {index + 1} (R$)
                    <Input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={part.value}
                      onChange={(e) =>
                        setParts(
                          parts.map((p, i) =>
                            i === index
                              ? { ...p, value: Number(e.target.value) }
                              : p,
                          ),
                        )
                      }
                    />
                  </Label>
                  <Label>
                    Vencimento
                    <Input
                      required
                      type="date"
                      value={part.dueDate}
                      onInput={(e) => {
                        const value = e.currentTarget.value;
                        setParts((current) =>
                          current.map((p, i) =>
                            i === index ? { ...p, dueDate: value } : p,
                          ),
                        );
                      }}
                      onChange={(e) =>
                        setParts(
                          parts.map((p, i) =>
                            i === index ? { ...p, dueDate: e.target.value } : p,
                          ),
                        )
                      }
                    />
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setParts(parts.filter((_, i) => i !== index))
                    }
                  >
                    Remover parcela
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={parts.length >= 24}
                onClick={() =>
                  setParts([
                    ...parts,
                    { value: parts.length ? 0 : (totals?.total ?? 0), dueDate },
                  ])
                }
              >
                Dividir em parcelas
              </Button>
              {parts.length > 0 && (
                <p className="text-sm">
                  As parcelas devem somar {formatCurrency(totals?.total ?? 0)}.
                  Sem parcelas, a conta usa o vencimento acima.
                </p>
              )}
            </div>
          )}
          <Label>
            Observações
            <Input
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !totals}>
              {busy
                ? "Confirmando recebimento…"
                : "Confirmar recebimento e conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
