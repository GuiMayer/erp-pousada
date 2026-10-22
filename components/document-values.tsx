"use client"
export const documentFields: Record<string, string> = {
  before: "Antes", after: "Depois", executorId: "Executor (ID)", approverId: "Responsável pela aprovação (ID)", permission: "Permissão", requestId: "Requisição", businessOperation: "Operação", amount: "Valor",
  id: "Identificador",
  date: "Data",
  value: "Valor",
  total: "Total",
  totalValue: "Valor acordado",
  status: "Situação",
  label: "Descrição",
  name: "Nome",
  description: "Descrição",
  quantity: "Quantidade",
  unit: "Unidade",
  code: "Lote",
  origin: "Origem",
  originType: "Tipo de origem",
  originId: "Identificador de origem",
  productId: "Produto",
  productName: "Bebida",
  supplierName: "Fornecedor",
  receivedAt: "Recebido em",
  dueDate: "Vencimento",
  paidValue: "Valor pago",
  paid: "Quitado",
  currentBalance: "Saldo interno",
  initialBalance: "Saldo inicial",
  sourceStayId: "Hospedagem de origem",
  sourcePurchaseId: "Compra de origem",
  recordVersion: "Versão",
  roomId: "Quarto",
  reservationId: "Reserva",
  guestName: "Hóspede",
  guestCount: "Ocupantes",
  checkIn: "Entrada",
  checkOut: "Saída",
  endedAt: "Encerramento",
  lodgingValue: "Diárias acordadas",
  nightlyPrices: "Preços por noite",
  allocations: "Alocações",
  charges: "Consumos",
  payments: "Pagamentos",
  adjustments: "Ajustes",
  items: "Itens",
  installments: "Parcelas",
  installmentNumber: "Parcela",
  unitPrice: "Preço unitário",
  lineTotal: "Total da linha",
  unitCost: "Custo unitário",
  remainingValue: "Valor restante",
  receivedQuantity: "Quantidade recebida",
  expiresAt: "Validade",
  costEstimated: "Custo estimado",
  paymentMethod: "Meio de pagamento",
  method: "Meio",
  type: "Tipo",
  operator: "Operador",
  responsible: "Responsável",
  createdAt: "Criado em",
  start: "Início",
  end: "Fim",
  openingValue: "Fundo de abertura",
  physicalValue: "Contagem física",
  expectedValue: "Valor esperado",
  divergence: "Divergência",
  freight: "Frete",
  discount: "Desconto",
  subtotal: "Subtotal",
  reason: "Motivo",
  reference: "Referência",
  acceptedPackages: "Embalagens aceitas",
  refusedPackages: "Embalagens recusadas",
  factor: "Unidades por embalagem",
  packagePrice: "Preço por embalagem",
  totalCost: "Custo total",
  baseQuantity: "Quantidade-base",
  packaging: "Embalagem",
  usableQuantity: "Quantidade utilizável",
  minimumStock: "Estoque mínimo",
  maximumStock: "Estoque máximo",
  costStatus: "Rastreabilidade do custo",
  overdue: "Vencido",
  position: "Posição",
  category: "Categoria",
  sourceSaleId: "Venda de origem",
  bucket: "Aplicação",
  amountPaid: "Valor oferecido",
  change: "Troco",
  customer: "Cliente",
  cancelReason: "Motivo de cancelamento",
  timestamp: "Data do movimento",
  registeredBy: "Registrado por",
};
export function OriginValues({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.length ? (
          value.map((v, i) => (
            <div key={i} className="rounded-md border p-3">
              <OriginValues value={v} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum item.</p>
        )}
      </div>
    );
  if (value && typeof value === "object")
    return (
      <dl className="space-y-2 text-sm">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="font-medium">
              {documentFields[k] ?? k.replace(/([A-Z])/g, " $1")}
            </dt>
            <dd className="break-words text-muted-foreground">
              {v && typeof v === "object" ? (
                <OriginValues value={v} />
              ) : v === null || v === undefined ? (
                "Não informado"
              ) : typeof v === "boolean" ? (
                v ? (
                  "Sim"
                ) : (
                  "Não"
                )
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value ?? "")}</span>;
}
