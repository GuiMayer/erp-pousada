# Especificação de Requisitos: Sistema de Gestão de Restaurante

## 1. Visão Geral do Negócio

**Contexto Operacional:**
- Restaurante com buffet self-service
- Serviço de marmitas (almoço e jantar)
- Atendimento balcão e empresas (B2C e B2B)
- Controle de consumo interno de funcionários
- Gestão de estoque e produção

**Objetivo do Sistema:**
Centralizar operações de venda, controle de estoque, gestão de produção e fechamento de caixa, eliminando processos manuais e proporcionando rastreabilidade completa das operações.

---

## 2. Módulos Funcionais

### 2.1 Módulo de Vendas (PDV - Ponto de Venda)

#### RF-PDV-001: Venda Rápida e Simplificada
**Descrição:** Sistema de venda otimizado para atendimento em horário de pico com interface intuitiva e fluxo mínimo de cliques.

**Requisitos Detalhados:**
- Interface touch-friendly com botões grandes (mínimo 60x60px)
- Atalhos de teclado para produtos mais vendidos (F1-F12)
- Busca rápida por código de barras ou nome do produto
- Adição de múltiplos itens sem confirmação intermediária
- Visualização em tempo real do total da venda
- Suporte a venda por peso (kg) e por unidade
- Modo "Express" para produtos pré-configurados (ex: "Marmita Padrão")

**Regras de Negócio:**
- RN-PDV-001: Tempo máximo de 3 segundos para registrar um item
- RN-PDV-002: Máximo de 3 cliques para finalizar uma venda simples
- RN-PDV-003: Sistema deve funcionar offline com sincronização posterior

**Dados Necessários:**
```typescript
interface Sale {
  id: string
  timestamp: Date
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  category: SaleCategory // almoço, jantar, marmita, bebidas, café
  customer?: Customer // opcional para B2B
  employee: Employee // operador do caixa
  status: 'pending' | 'completed' | 'cancelled'
}

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  unit: 'kg' | 'un'
  unitPrice: number
  subtotal: number
  category: ProductCategory
}
```

---

#### RF-PDV-002: Separação por Categorias
**Descrição:** Organização de produtos e vendas por categorias operacionais para facilitar análise e controle.

**Categorias Obrigatórias:**
1. **Almoço** - Buffet e pratos executivos (11h-15h)
2. **Jantar** - Buffet e pratos noturnos (18h-22h)
3. **Marmita** - Refeições para viagem (almoço e jantar)
4. **Bebidas** - Refrigerantes, sucos, água
5. **Café** - Café, cappuccino, lanches rápidos

**Requisitos Detalhados:**
- Filtro visual por categoria na tela de venda
- Cores distintas para cada categoria
- Ícones representativos para identificação rápida
- Possibilidade de venda mista (múltiplas categorias na mesma comanda)
- Relatórios separados por categoria

**Regras de Negócio:**
- RN-CAT-001: Produtos podem pertencer a apenas uma categoria principal
- RN-CAT-002: Horários de pico devem destacar categoria correspondente
- RN-CAT-003: Marmitas devem ter controle de quantidade de embalagens

**Dados Necessários:**
```typescript
interface ProductCategory {
  id: string
  name: 'almoço' | 'jantar' | 'marmita' | 'bebidas' | 'café'
  color: string
  icon: string
  active: boolean
  peakHours: { start: string, end: string }
}

interface Product {
  id: string
  name: string
  category: ProductCategory
  price: number
  unit: 'kg' | 'un'
  stockControl: boolean
  active: boolean
}
```

---

#### RF-PDV-003: Comandas Simples
**Descrição:** Sistema de comandas para controle de consumo em mesa ou balcão.

**Requisitos Detalhados:**
- Abertura rápida de comanda com número sequencial
- Lançamento de itens na comanda aberta
- Visualização de todas as comandas abertas
- Fechamento de comanda com cálculo automático
- Impressão de comprovante
- Possibilidade de dividir conta
- Transferência de itens entre comandas
- Cancelamento de itens com justificativa

**Regras de Negócio:**
- RN-COM-001: Comandas abertas há mais de 4 horas devem gerar alerta
- RN-COM-002: Cancelamento de item requer senha de supervisor
- RN-COM-003: Comandas não podem ser excluídas, apenas canceladas
- RN-COM-004: Histórico de alterações deve ser mantido para auditoria

**Dados Necessários:**
```typescript
interface Comanda {
  id: string
  number: number
  openedAt: Date
  closedAt?: Date
  items: ComandaItem[]
  subtotal: number
  discount: number
  total: number
  status: 'open' | 'closed' | 'cancelled'
  table?: string
  customer?: string
  employee: Employee
  paymentMethod?: PaymentMethod
}

interface ComandaItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
  addedAt: Date
  addedBy: Employee
  cancelled: boolean
  cancelledAt?: Date
  cancelledBy?: Employee
  cancelReason?: string
}
```

---

### 2.2 Módulo de Caixa e Fechamento

#### RF-CAI-001: Fechamento Diário de Caixa
**Descrição:** Processo de abertura e fechamento de caixa com conferência de valores e registro de divergências.

**Requisitos Detalhados:**
- Abertura de caixa com valor inicial (fundo de troco)
- Registro de todas as transações durante o dia
- Fechamento com contagem física por forma de pagamento
- Cálculo automático de diferenças (sobra/falta)
- Registro de sangrias (retiradas de dinheiro)
- Registro de suprimentos (adição de dinheiro)
- Impressão de relatório de fechamento
- Histórico de fechamentos anteriores

**Regras de Negócio:**
- RN-CAI-001: Caixa deve ser aberto antes de qualquer venda
- RN-CAI-002: Sangrias acima de R$ 500 requerem aprovação de supervisor
- RN-CAI-003: Diferenças acima de R$ 50 devem gerar alerta
- RN-CAI-004: Fechamento de caixa é obrigatório ao final do expediente
- RN-CAI-005: Apenas supervisor pode reabrir caixa fechado

**Dados Necessários:**
```typescript
interface CashRegister {
  id: string
  openedAt: Date
  openedBy: Employee
  initialAmount: number
  closedAt?: Date
  closedBy?: Employee
  status: 'open' | 'closed'
  
  // Valores esperados (calculados pelo sistema)
  expectedCash: number
  expectedDebit: number
  expectedCredit: number
  expectedPix: number
  
  // Valores contados (informados pelo operador)
  countedCash?: number
  countedDebit?: number
  countedCredit?: number
  countedPix?: number
  
  // Diferenças
  cashDifference?: number
  debitDifference?: number
  creditDifference?: number
  pixDifference?: number
  
  withdrawals: Withdrawal[] // sangrias
  supplies: Supply[] // suprimentos
  notes?: string
}

interface Withdrawal {
  id: string
  amount: number
  reason: string
  timestamp: Date
  authorizedBy: Employee
  receivedBy: string
}

interface Supply {
  id: string
  amount: number
  reason: string
  timestamp: Date
  addedBy: Employee
}
```

---

#### RF-CAI-002: Controle por Forma de Pagamento
**Descrição:** Registro e controle detalhado de todas as formas de pagamento aceitas.

**Formas de Pagamento Obrigatórias:**
1. **Dinheiro** - Pagamento em espécie
2. **PIX** - Transferência instantânea
3. **Cartão de Débito** - Débito em conta
4. **Cartão de Crédito** - Crédito parcelado ou à vista

**Requisitos Detalhados:**
- Seleção rápida de forma de pagamento
- Suporte a pagamento misto (múltiplas formas)
- Cálculo automático de troco para dinheiro
- Registro de comprovante para PIX
- Integração com máquina de cartão (futuro)
- Taxa de administração por forma de pagamento
- Relatório de vendas por forma de pagamento

**Regras de Negócio:**
- RN-PAG-001: Pagamento em dinheiro acima de R$ 200 deve gerar alerta
- RN-PAG-002: PIX deve ter comprovante anexado
- RN-PAG-003: Cartão de crédito pode ter taxa de administração (2-4%)
- RN-PAG-004: Troco máximo permitido: R$ 50

**Dados Necessários:**
```typescript
interface PaymentMethod {
  id: string
  name: 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
  active: boolean
  adminFee: number // percentual de taxa
  requiresReceipt: boolean
  icon: string
  color: string
}

interface Payment {
  id: string
  saleId: string
  method: PaymentMethod
  amount: number
  receivedAmount?: number // para dinheiro
  change?: number // para dinheiro
  receipt?: string // comprovante PIX
  timestamp: Date
  processedBy: Employee
}
```

---

#### RF-CAI-003: Relatório Diário e Mensal de Vendas
**Descrição:** Geração de relatórios consolidados de vendas com múltiplas visões e filtros.

**Relatórios Obrigatórios:**

**1. Relatório Diário:**
- Total de vendas por categoria
- Total por forma de pagamento
- Número de transações
- Ticket médio
- Produtos mais vendidos
- Horários de pico
- Comparativo com dia anterior

**2. Relatório Mensal:**
- Faturamento total do mês
- Evolução diária (gráfico)
- Comparativo com mês anterior
- Produtos mais vendidos do mês
- Análise por categoria
- Análise por forma de pagamento
- Dias de maior/menor movimento

**Requisitos Detalhados:**
- Filtros por período (dia, semana, mês, customizado)
- Filtros por categoria
- Filtros por forma de pagamento
- Exportação para PDF e Excel
- Gráficos visuais (barras, linhas, pizza)
- Impressão direta
- Envio por email

**Dados Necessários:**
```typescript
interface SalesReport {
  period: {
    start: Date
    end: Date
  }
  summary: {
    totalSales: number
    totalTransactions: number
    averageTicket: number
    totalByCategory: Record<string, number>
    totalByPaymentMethod: Record<string, number>
  }
  topProducts: {
    productId: string
    productName: string
    quantity: number
    revenue: number
  }[]
  dailyBreakdown: {
    date: Date
    sales: number
    transactions: number
  }[]
  peakHours: {
    hour: number
    transactions: number
    revenue: number
  }[]
}
```

---

### 2.3 Módulo de Controle de Consumo Interno

#### RF-CON-001: Controle de Consumo de Funcionários
**Descrição:** Sistema para registro e controle de refeições e produtos consumidos por funcionários.

**Requisitos Detalhados:**
- Cadastro de funcionários com foto
- Identificação rápida por crachá ou biometria (futuro)
- Registro de consumo com categoria (almoço, jantar, lanche)
- Limite de consumo por funcionário (configurável)
- Desconto em folha ou pagamento direto
- Relatório de consumo por funcionário
- Relatório de consumo por período
- Alertas de consumo acima do limite

**Regras de Negócio:**
- RN-FUN-001: Funcionários têm direito a 1 refeição por turno
- RN-FUN-002: Consumo adicional deve ser pago ou descontado
- RN-FUN-003: Limite mensal de consumo deve ser configurável
- RN-FUN-004: Gerentes podem ter limites diferenciados
- RN-FUN-005: Consumo de funcionário não entra no caixa diário

**Dados Necessários:**
```typescript
interface Employee {
  id: string
  name: string
  cpf: string
  photo?: string
  role: 'caixa' | 'cozinha' | 'atendimento' | 'gerente' | 'supervisor'
  active: boolean
  consumptionLimit: number // valor mensal
  mealBenefit: {
    lunchIncluded: boolean
    dinnerIncluded: boolean
    snackIncluded: boolean
  }
}

interface EmployeeConsumption {
  id: string
  employeeId: string
  employeeName: string
  items: ConsumptionItem[]
  total: number
  category: 'almoço' | 'jantar' | 'lanche'
  timestamp: Date
  registeredBy: Employee
  paymentType: 'benefit' | 'discount' | 'paid'
  notes?: string
}

interface ConsumptionItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
}
```

---

### 2.4 Módulo de Estoque e Produção

#### RF-EST-001: Controle de Estoque
**Descrição:** Gestão completa de estoque de insumos e produtos acabados com controle de entrada, saída e inventário.

**Requisitos Detalhados:**
- Cadastro de produtos com unidade de medida
- Registro de entrada de mercadorias (compras)
- Registro de saída (vendas e consumo interno)
- Baixa automática de estoque em vendas
- Controle de estoque mínimo com alertas
- Controle de validade de produtos perecíveis
- Inventário periódico com ajustes
- Relatório de movimentação de estoque
- Relatório de produtos próximos ao vencimento
- Custo médio ponderado (CMV)

**Regras de Negócio:**
- RN-EST-001: Estoque não pode ficar negativo
- RN-EST-002: Produtos com estoque abaixo do mínimo geram alerta
- RN-EST-003: Produtos vencidos devem ser bloqueados para venda
- RN-EST-004: Ajustes de inventário requerem justificativa
- RN-EST-005: Entrada de mercadoria deve ter nota fiscal

**Dados Necessários:**
```typescript
interface StockItem {
  id: string
  productId: string
  productName: string
  currentStock: number
  unit: 'kg' | 'un' | 'lt' | 'cx'
  minimumStock: number
  maximumStock: number
  averageCost: number
  lastPurchasePrice: number
  lastPurchaseDate: Date
  supplier?: Supplier
}

interface StockMovement {
  id: string
  type: 'entrada' | 'saida' | 'ajuste' | 'perda'
  productId: string
  quantity: number
  unit: string
  cost?: number
  reason: string
  timestamp: Date
  registeredBy: Employee
  invoiceNumber?: string
  expirationDate?: Date
  notes?: string
}

interface Supplier {
  id: string
  name: string
  cnpj: string
  phone: string
  email: string
  address: string
  active: boolean
  products: string[] // IDs de produtos fornecidos
}
```

---

#### RF-EST-002: Controle de Produção
**Descrição:** Gestão de produção de alimentos com controle de receitas, ingredientes e custos.

**Requisitos Detalhados:**
- Cadastro de receitas com ingredientes e quantidades
- Cálculo automático de custo de produção
- Registro de produção diária
- Baixa automática de ingredientes do estoque
- Controle de rendimento (quantidade produzida vs esperada)
- Ficha técnica de produtos
- Cálculo de margem de lucro
- Relatório de produção por período
- Análise de desperdício

**Regras de Negócio:**
- RN-PRO-001: Produção deve baixar ingredientes do estoque automaticamente
- RN-PRO-002: Rendimento abaixo de 90% deve gerar alerta
- RN-PRO-003: Custo de produção deve ser atualizado a cada compra de ingrediente
- RN-PRO-004: Margem de lucro mínima deve ser de 60%
- RN-PRO-005: Receitas devem ter versão para rastreabilidade

**Dados Necessários:**
```typescript
interface Recipe {
  id: string
  name: string
  category: ProductCategory
  version: number
  ingredients: RecipeIngredient[]
  expectedYield: number // quantidade esperada
  yieldUnit: 'kg' | 'un' | 'lt'
  preparationTime: number // minutos
  instructions: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

interface RecipeIngredient {
  productId: string
  productName: string
  quantity: number
  unit: string
  cost: number
}

interface Production {
  id: string
  recipeId: string
  recipeName: string
  plannedQuantity: number
  producedQuantity: number
  yield: number // percentual
  totalCost: number
  unitCost: number
  timestamp: Date
  producedBy: Employee
  notes?: string
  ingredients: {
    productId: string
    quantityUsed: number
    cost: number
  }[]
}
```

---

### 2.5 Módulo de Atendimento a Empresas (B2B)

#### RF-EMP-001: Gestão de Clientes Empresariais
**Descrição:** Controle de vendas para empresas com faturamento, crédito e relatórios específicos.

**Requisitos Detalhados:**
- Cadastro de empresas com CNPJ
- Limite de crédito por empresa
- Vendas a prazo com controle de vencimento
- Faturamento mensal consolidado
- Emissão de nota fiscal (integração futura)
- Relatório de vendas por empresa
- Controle de inadimplência
- Histórico de compras

**Regras de Negócio:**
- RN-EMP-001: Vendas acima do limite de crédito requerem aprovação
- RN-EMP-002: Empresas inadimplentes devem ser bloqueadas
- RN-EMP-003: Faturamento deve ser gerado até o dia 5 do mês seguinte
- RN-EMP-004: Desconto para empresas deve ser pré-aprovado

**Dados Necessários:**
```typescript
interface Company {
  id: string
  name: string
  tradeName: string
  cnpj: string
  contact: string
  phone: string
  email: string
  address: string
  creditLimit: number
  currentDebt: number
  paymentTerm: number // dias
  discount: number // percentual
  active: boolean
  blocked: boolean
  blockReason?: string
}

interface CompanySale {
  id: string
  companyId: string
  companyName: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  dueDate: Date
  paidAt?: Date
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  invoiceNumber?: string
  timestamp: Date
  registeredBy: Employee
}
```

---

## 3. Requisitos Não Funcionais

### RNF-001: Performance
- Tempo de resposta máximo de 2 segundos para qualquer operação
- Suporte a 100 transações simultâneas
- Banco de dados otimizado para consultas rápidas
- Cache de produtos mais vendidos

### RNF-002: Usabilidade
- Interface responsiva (desktop, tablet, smartphone)
- Modo escuro para reduzir fadiga visual
- Atalhos de teclado para operações frequentes
- Feedback visual imediato para todas as ações
- Mensagens de erro claras e acionáveis

### RNF-003: Segurança
- Autenticação obrigatória para todos os usuários
- Níveis de acesso (caixa, gerente, supervisor, admin)
- Senha de supervisor para operações críticas
- Log de auditoria imutável
- Backup automático diário
- Criptografia de dados sensíveis

### RNF-004: Confiabilidade
- Sistema deve funcionar offline com sincronização
- Backup automático a cada 6 horas
- Recuperação de desastres em até 1 hora
- Disponibilidade de 99.5% (máximo 3.6 horas de downtime/mês)

### RNF-005: Manutenibilidade
- Código modular e bem documentado
- Testes automatizados (mínimo 80% de cobertura)
- Logs detalhados para troubleshooting
- Versionamento de banco de dados
- Documentação técnica atualizada

### RNF-006: Escalabilidade
- Suporte a múltiplos pontos de venda
- Suporte a múltiplas unidades (franquias)
- Banco de dados preparado para crescimento
- Arquitetura que suporta microserviços (futuro)

---

## 4. Integrações Futuras

### INT-001: Integração com Máquina de Cartão
- Comunicação direta com POS (Stone, Cielo, Rede)
- Confirmação automática de pagamento
- Conciliação bancária automática

### INT-002: Emissão de Nota Fiscal Eletrônica
- Integração com sistema de NF-e
- Emissão automática após venda
- Envio por email para cliente

### INT-003: Sistema de Delivery
- Integração com iFood, Rappi, Uber Eats
- Sincronização automática de pedidos
- Atualização de estoque em tempo real

### INT-004: ERP Contábil
- Exportação de dados para contabilidade
- Integração com sistemas contábeis (Conta Azul, Omie)
- Relatórios fiscais automatizados

---

## 5. Fluxos Principais

### Fluxo 1: Venda Rápida no Balcão
1. Operador abre tela de venda
2. Seleciona categoria (ex: Marmita)
3. Adiciona produtos rapidamente
4. Sistema calcula total automaticamente
5. Seleciona forma de pagamento
6. Confirma venda
7. Imprime comprovante (opcional)
8. Sistema baixa estoque automaticamente

### Fluxo 2: Atendimento com Comanda
1. Operador abre nova comanda
2. Lança itens conforme pedido do cliente
3. Cliente solicita fechamento
4. Sistema calcula total
5. Aplica desconto (se houver)
6. Cliente escolhe forma de pagamento
7. Fecha comanda
8. Imprime comprovante

### Fluxo 3: Fechamento de Caixa
1. Supervisor acessa módulo de caixa
2. Sistema exibe valores esperados por forma de pagamento
3. Operador conta valores físicos
4. Informa valores contados no sistema
5. Sistema calcula diferenças
6. Operador justifica diferenças (se houver)
7. Sistema gera relatório de fechamento
8. Imprime relatório
9. Caixa é fechado

### Fluxo 4: Controle de Estoque
1. Mercadoria chega do fornecedor
2. Operador registra entrada com nota fiscal
3. Sistema atualiza estoque
4. Sistema calcula novo custo médio
5. Produtos com estoque baixo geram alerta
6. Gerente visualiza alertas
7. Gerente faz pedido de reposição

### Fluxo 5: Produção Diária
1. Cozinheiro acessa módulo de produção
2. Seleciona receita a ser produzida
3. Informa quantidade a produzir
4. Sistema calcula ingredientes necessários
5. Sistema verifica disponibilidade em estoque
6. Cozinheiro confirma produção
7. Sistema baixa ingredientes do estoque
8. Cozinheiro informa quantidade produzida
9. Sistema calcula rendimento
10. Produtos prontos ficam disponíveis para venda

---

## 6. Priorização de Implementação

### Fase 1 - MVP (Mínimo Produto Viável) - 2 meses
- RF-PDV-001: Venda Rápida
- RF-PDV-002: Separação por Categorias
- RF-CAI-001: Fechamento de Caixa
- RF-CAI-002: Controle por Forma de Pagamento
- RF-CAI-003: Relatório Diário

### Fase 2 - Expansão Operacional - 1.5 meses
- RF-PDV-003: Comandas Simples
- RF-CON-001: Controle de Consumo de Funcionários
- RF-EST-001: Controle de Estoque (básico)

### Fase 3 - Gestão Avançada - 2 meses
- RF-EST-002: Controle de Produção
- RF-EMP-001: Gestão de Clientes Empresariais
- RF-CAI-003: Relatório Mensal (completo)

### Fase 4 - Integrações - 1.5 meses
- INT-001: Integração com Máquina de Cartão
- INT-002: Emissão de NF-e
- INT-003: Sistema de Delivery

---

## 7. Estimativa de Esforço

| Módulo | Complexidade | Tempo Estimado | Prioridade |
|--------|--------------|----------------|------------|
| PDV Básico | Média | 3 semanas | Alta |
| Comandas | Média | 2 semanas | Alta |
| Fechamento de Caixa | Alta | 2 semanas | Alta |
| Relatórios | Média | 2 semanas | Alta |
| Controle de Estoque | Alta | 3 semanas | Média |
| Controle de Produção | Alta | 3 semanas | Média |
| Consumo Funcionários | Baixa | 1 semana | Média |
| Gestão B2B | Média | 2 semanas | Baixa |
| Integrações | Alta | 4 semanas | Baixa |

**Total Estimado:** 6-7 meses para sistema completo

---

## 8. Stack Tecnológica Recomendada

### Frontend
- **Framework:** Next.js 15 (já em uso)
- **UI:** React 19 + TypeScript
- **Estilização:** Tailwind CSS
- **Componentes:** shadcn/ui
- **Estado:** Zustand ou Redux Toolkit
- **Formulários:** React Hook Form + Zod

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Next.js API Routes ou NestJS
- **Banco de Dados:** PostgreSQL 15+
- **ORM:** Prisma
- **Cache:** Redis
- **Fila:** Bull (para processamento assíncrono)

### Infraestrutura
- **Hospedagem:** Vercel (frontend) + Railway/Render (backend)
- **Banco de Dados:** Supabase ou Railway
- **Storage:** AWS S3 ou Cloudflare R2
- **Monitoramento:** Sentry + Vercel Analytics

### Ferramentas
- **Testes:** Vitest + React Testing Library
- **E2E:** Playwright
- **CI/CD:** GitHub Actions
- **Documentação:** Storybook

---

## 9. Considerações Finais

Este sistema representa uma evolução significativa do sistema de pousada atual, com foco em operações de restaurante. As principais diferenças são:

1. **Velocidade:** Operações devem ser muito mais rápidas (horário de pico)
2. **Volume:** Muito mais transações por dia
3. **Estoque:** Controle crítico de perecíveis e produção
4. **Complexidade:** Múltiplos tipos de atendimento (balcão, comanda, empresas)

**Recomendações:**
- Iniciar com MVP focado em PDV e fechamento de caixa
- Validar com usuários reais antes de expandir
- Implementar testes automatizados desde o início
- Considerar migração para banco de dados real (PostgreSQL)
- Planejar arquitetura para suportar múltiplas unidades

**Próximos Passos:**
1. Validar requisitos com cliente
2. Criar protótipos de tela (Figma)
3. Definir arquitetura de dados
4. Implementar MVP (Fase 1)
5. Testar com usuários piloto
6. Iterar e expandir funcionalidades
