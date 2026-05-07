import { Badge } from "@/components/ui/badge"
import { 
  Banknote, CreditCard, QrCode 
} from "lucide-react"

type PaymentMethod = "dinheiro" | "cartao_debito" | "cartao_credito" | "pix"

const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  dinheiro: {
    label: "Dinheiro",
    icon: <Banknote className="size-3.5" />,
  },
  cartao_debito: {
    label: "Cartão Débito",
    icon: <CreditCard className="size-3.5" />,
  },
  cartao_credito: {
    label: "Cartão Crédito",
    icon: <CreditCard className="size-3.5" />,
  },
  pix: {
    label: "PIX",
    icon: <QrCode className="size-3.5" />,
  },
}

type PaymentMethodBadgeProps = {
  method: PaymentMethod
  className?: string
}

/**
 * Reusable payment method badge
 */
export function PaymentMethodBadge({ method, className }: PaymentMethodBadgeProps) {
  const config = paymentMethodConfig[method]

  if (!config) return null

  return (
    <Badge variant="outline" className={className}>
      {config.icon}
      <span className="ml-1">{config.label}</span>
    </Badge>
  )
}
