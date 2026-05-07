"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/app-context"
import { useAuth } from "@/lib/auth-context"
import { Users, Search, Plus, Minus, Trash2, AlertTriangle, ShoppingCart } from "lucide-react"
import type { Employee, POSProduct, EmployeeConsumption } from "@/lib/store"

interface CartItem {
  id: string
  product: POSProduct
  quantity: number
}

type MealType = "almoco" | "jantar" | "lanche" | "outros"
type PaymentType = "desconto_folha" | "beneficio" | "dinheiro"

interface Props {
  open: boolean
  onClose: () => void
}

export function EmployeeConsumptionModal({ open, onClose }: Props) {
  const { employees, posProducts, employeeConsumptions, addEmployeeConsumption, addAuditEntry } = useApp()
  const { username } = useAuth()

  const [step, setStep] = useState<"select" | "cart" | "confirm">("select")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [mealType, setMealType] = useState<MealType>("outros")
  const [paymentType, setPaymentType] = useState<PaymentType>("desconto_folha")
  const [formError, setFormError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  const activeEmployees = useMemo(
    () => employees.filter(e => e.active).sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return activeEmployees
    const query = searchQuery.toLowerCase()
    return activeEmployees.filter(
      e =>
        e.name.toLowerCase().includes(query) ||
        e.cpf.includes(query.replace(/\D/g, ""))
    )
  }, [activeEmployees, searchQuery])

  const filteredProducts = useMemo(() => {
    if (!productSearch) return posProducts
    const query = productSearch.toLowerCase()
    return posProducts.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    )
  }, [posProducts, productSearch])

  const getMonthlyConsumption = (employeeId: number): number => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    return employeeConsumptions
      .filter(c => c.employeeId === employeeId && c.date.startsWith(thisMonth))
      .reduce((sum, c) => sum + c.total, 0)
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  }, [cart])

  const remainingLimit = useMemo(() => {
    if (!selectedEmployee) return 0
    const consumed = getMonthlyConsumption(selectedEmployee.id)
    return selectedEmployee.consumptionLimit - consumed - cartTotal
  }, [selectedEmployee, cartTotal])

  function resetForm() {
    setStep("select")
    setSelectedEmployee(null)
    setSearchQuery("")
    setProductSearch("")
    setCart([])
    setMealType("outros")
    setPaymentType("desconto_folha")
    setFormError("")
  }

  function handleSelectEmployee(employee: Employee) {
    setSelectedEmployee(employee)
    setStep("cart")
    setFormError("")
  }

  function addToCart(product: POSProduct) {
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity: 1,
      }])
    }
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  function removeFromCart(itemId: string) {
    setCart(cart.filter(item => item.id !== itemId))
  }

  function handleNext() {
    if (cart.length === 0) {
      setFormError("Adicione pelo menos um produto ao carrinho")
      return
    }

    if (paymentType === "beneficio") {
      // Check if meal type is included in benefits
      if (mealType === "almoco" && !selectedEmployee?.mealBenefit.lunchIncluded) {
        setFormError("Funcionário não tem almoço incluído nos benefícios")
        return
      }
      if (mealType === "jantar" && !selectedEmployee?.mealBenefit.dinnerIncluded) {
        setFormError("Funcionário não tem jantar incluído nos benefícios")
        return
      }
      if (mealType === "lanche" && !selectedEmployee?.mealBenefit.snackIncluded) {
        setFormError("Funcionário não tem lanche incluído nos benefícios")
        return
      }
    }

    if (paymentType === "desconto_folha" && remainingLimit < 0) {
      setFormError("Consumo excede o limite mensal do funcionário")
      return
    }

    setFormError("")
    setConfirmOpen(true)
  }

  function handleConfirm() {
    if (!selectedEmployee) return

    const newId = Math.max(...employeeConsumptions.map(c => c.id), 0) + 1
    const consumption: EmployeeConsumption = {
      id: newId,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        subtotal: item.product.price * item.quantity,
      })),
      total: cartTotal,
      mealType,
      paymentType,
      date: new Date().toISOString(),
      operator: username || "sistema",
    }

    addEmployeeConsumption(consumption)

    addAuditEntry({
      user: username || "sistema",
      action: "Consumo de funcionário registrado",
      reference: `${selectedEmployee.name} - R$ ${cartTotal.toFixed(2)}`,
    })

    setConfirmOpen(false)
    resetForm()
    onClose()
  }

  function formatCPF(cpf: string): string {
    if (cpf.length !== 11) return cpf
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`
  }

  function getMealTypeLabel(type: MealType): string {
    const labels: Record<MealType, string> = {
      almoco: "Almoço",
      jantar: "Jantar",
      lanche: "Lanche",
      outros: "Outros",
    }
    return labels[type]
  }

  function getPaymentTypeLabel(type: PaymentType): string {
    const labels: Record<PaymentType, string> = {
      desconto_folha: "Desconto em Folha",
      beneficio: "Benefício (Gratuito)",
      dinheiro: "Dinheiro",
    }
    return labels[type]
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={v => {
          if (!v) {
            resetForm()
            onClose()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Registrar Consumo de Funcionário
            </DialogTitle>
            <DialogDescription>
              {step === "select" && "Selecione o funcionário"}
              {step === "cart" && "Adicione produtos ao carrinho"}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {filteredEmployees.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum funcionário encontrado
                  </p>
                ) : (
                  filteredEmployees.map(employee => {
                    const consumed = getMonthlyConsumption(employee.id)
                    const consumedPercent = (consumed / employee.consumptionLimit) * 100

                    return (
                      <button
                        key={employee.id}
                        onClick={() => handleSelectEmployee(employee)}
                        className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3 text-left hover:bg-secondary transition-colors"
                      >
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <span className="font-medium text-foreground">
                            {employee.name}
                          </span>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>CPF: {formatCPF(employee.cpf)}</span>
                            <span>•</span>
                            <span>{employee.role}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Limite: R$ {employee.consumptionLimit.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span
                              className={
                                consumedPercent > 90
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              Consumido: R$ {consumed.toFixed(2)} ({consumedPercent.toFixed(0)}%)
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {employee.mealBenefit.lunchIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Almoço
                              </Badge>
                            )}
                            {employee.mealBenefit.dinnerIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Jantar
                              </Badge>
                            )}
                            {employee.mealBenefit.snackIncluded && (
                              <Badge variant="secondary" className="text-xs">
                                Lanche
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {step === "cart" && selectedEmployee && (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {formError}
                </div>
              )}

              <div className="rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">
                    {selectedEmployee.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {selectedEmployee.role}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Limite: R$ {selectedEmployee.consumptionLimit.toFixed(2)}</div>
                  <div>Consumido: R$ {getMonthlyConsumption(selectedEmployee.id).toFixed(2)}</div>
                  <div
                    className={remainingLimit < 0 ? "text-red-600 font-medium" : ""}
                  >
                    Disponível: R$ {remainingLimit.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mealType">Tipo de Consumo</Label>
                  <Select value={mealType} onValueChange={(v: MealType) => setMealType(v)}>
                    <SelectTrigger id="mealType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="almoco">Almoço</SelectItem>
                      <SelectItem value="jantar">Jantar</SelectItem>
                      <SelectItem value="lanche">Lanche</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="paymentType">Forma de Pagamento</Label>
                  <Select value={paymentType} onValueChange={(v: PaymentType) => setPaymentType(v)}>
                    <SelectTrigger id="paymentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desconto_folha">Desconto em Folha</SelectItem>
                      <SelectItem value="beneficio">Benefício (Gratuito)</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <Label>Carrinho</Label>
                  <Badge variant="outline">
                    Total: R$ {cartTotal.toFixed(2)}
                  </Badge>
                </div>

                {cart.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 opacity-30" />
                    <span className="text-sm">Carrinho vazio</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                      >
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {item.product.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            R$ {item.product.price.toFixed(2)} x {item.quantity}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <span className="text-sm font-medium tabular-nums">
                          R$ {(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <Label>Adicionar Produtos</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {filteredProducts.slice(0, 5).map(product => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center justify-between p-2 rounded hover:bg-secondary text-left text-sm"
                      >
                        <span className="truncate">{product.name}</span>
                        <span className="text-muted-foreground ml-2">
                          R$ {product.price.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {remainingLimit < 0 && paymentType === "desconto_folha" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <span className="text-sm text-orange-900">
                    Consumo excede o limite mensal em R$ {Math.abs(remainingLimit).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {step === "select" && (
              <Button onClick={onClose}>Cancelar</Button>
            )}

            {step === "cart" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select")
                    setCart([])
                    setFormError("")
                  }}
                >
                  Voltar
                </Button>
                <Button onClick={handleNext} disabled={cart.length === 0}>
                  Registrar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Consumo</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme o registro de consumo do funcionário:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedEmployee && (
            <div className="space-y-3 py-2">
              <div>
                <span className="text-sm font-medium">Funcionário:</span>
                <div className="text-sm text-muted-foreground">
                  {selectedEmployee.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm font-medium">Tipo:</span>
                  <div className="text-sm text-muted-foreground">
                    {getMealTypeLabel(mealType)}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Pagamento:</span>
                  <div className="text-sm text-muted-foreground">
                    {getPaymentTypeLabel(paymentType)}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Itens:</span>
                <div className="text-sm text-muted-foreground space-y-1 mt-1">
                  {cart.map(item => (
                    <div key={item.id}>
                      {item.quantity}x {item.product.name} - R${" "}
                      {(item.product.price * item.quantity).toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Total:</span>
                <div className="text-sm font-bold">R$ {cartTotal.toFixed(2)}</div>
              </div>

              {paymentType === "desconto_folha" && (
                <div>
                  <span className="text-sm font-medium">Limite Restante:</span>
                  <div
                    className={`text-sm font-medium ${
                      remainingLimit < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    R$ {remainingLimit.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
