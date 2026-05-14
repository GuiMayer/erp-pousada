# 📋 RELATÓRIO COMPLETO DE AUDITORIA DO MOTOR DE REGRAS DE NEGÓCIO

## 🎯 CONTEXTO DA AUDITORIA

Realizei uma auditoria completa e sistemática do motor de regras de negócio da aplicação  **v0-agi-pousada** , investigando:

* **73 arquivos TypeScript/TSX** no diretório `lib/`
* **28 repositórios** de dados
* **15 hooks customizados** de lógica de negócio
* **12 utilitários** de cálculo e validação
* **3 contextos** principais (App, Auth, Alert)
* **Estrutura de tipos** completa no `store.ts` (1048 linhas)

---

## 🏗️ MAPA DA ARQUITETURA ATUAL

### **Camadas Identificadas**

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│              (Components - não auditado)                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Contexts   │  │    Hooks     │  │  Validators  │  │
│  │ (3 arquivos) │  │(15 arquivos) │  │(1 arquivo)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Price Calc   │  │ Stock Sync   │  │Business Rules│  │
│  │(1 arquivo)   │  │(1 arquivo)   │  │(1 hook)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │         28 Repositories (CRUD operations)        │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Storage Adapter│ │ API Adapter  │  │ Sync Manager │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                     │
│         localStorage / API Backend (configurável)        │
└─────────────────────────────────────────────────────────┘
```

### **Principais Módulos de Regras de Negócio**

| Módulo                       | Responsabilidade                                 | Localização                        |
| ----------------------------- | ------------------------------------------------ | ------------------------------------ |
| **useBusinessRules**    | Validação de thresholds e alertas              | `lib/hooks/useBusinessRules.ts`    |
| **useCart**             | Gestão de carrinho com validação de estoque   | `lib/hooks/useCart.ts`             |
| **usePayment**          | Fluxo de pagamento e cálculo de troco           | `lib/hooks/usePayment.ts`          |
| **useDiscount**         | Validação de desconto e aprovação supervisor | `lib/hooks/useDiscount.ts`         |
| **useStockControl**     | Controle de estoque e movimentações            | `lib/hooks/useStockControl.ts`     |
| **useStockIntegration** | Integração estoque-vendas com rollback         | `lib/hooks/useStockIntegration.ts` |
| **useProduction**       | Gestão de receitas e produção                 | `lib/hooks/useProduction.ts`       |
| **useOrderManagement**  | Gestão de comandas de restaurante               | `lib/hooks/useOrderManagement.ts`  |
| **price-calculations**  | Cálculos centralizados de preço                | `lib/utils/price-calculations.ts`  |
| **validators**          | Validações de dados e regras                   | `lib/utils/validators.ts`          |
| **stock-sync**          | Sincronização produto-estoque                  | `lib/utils/stock-sync.ts`          |

---

## 🚨 PROBLEMAS IDENTIFICADOS (Categorizados por Severidade)

### **🔴 CRÍTICO - Segurança e Integridade de Dados**

#### **C1. Senha de Supervisor Hardcoded**

**Arquivo:** `lib/utils/validators.ts:189`

```typescript
const SUPERVISOR_PASSWORD = process.env.NEXT_PUBLIC_SUPERVISOR_PASSWORD || "admin"
```

**Problema:**

* Senha padrão "admin" exposta no código
* Variável de ambiente com prefixo `NEXT_PUBLIC_` é exposta no bundle do cliente
* Qualquer usuário pode inspecionar o código e descobrir a senha

**Impacto:** Qualquer pessoa pode aprovar descontos acima do teto sem autorização real.

---

#### **C2. Senhas de Usuários em Texto Plano**

**Arquivo:** `lib/store.ts:920-938`

```typescript
export const initialUsers: User[] = [
  {
    username: "supervisor",
    password: "adm123", // In production, this would be hashed
    role: "supervisor",
  },
  {
    username: "operador",
    password: "1234",
    role: "operador",
  },
]
```

**Problema:**

* Senhas armazenadas em texto plano
* Comentário indica conhecimento do problema mas não foi implementado
* Sem hashing, sem salt, sem proteção

**Impacto:** Comprometimento total do sistema de autenticação.

---

#### **C3. Rollback de Estoque Incompleto**

**Arquivo:** `lib/hooks/useStockIntegration.ts:196-220`

```typescript
const rollbackStock = useCallback(async (
  movementIds: string[],
  registeredBy: string
): Promise<void> => {
  try {
    // Note: In a real implementation, we would fetch the original movements
    // and create compensating "entrada" movements. For now, we just log.
    console.warn('Stock rollback requested for movements:', movementIds)
  
    addAlert({
      type: 'error',
      priority: 'high',
      title: 'Erro no Processamento de Estoque',
      message: 'Operação revertida. Verifique o estoque manualmente.',
    })
  } catch (error) {
    console.error('Failed to rollback stock:', error)
  }
}, [addAlert])
```

**Problema:**

* Função de rollback **NÃO IMPLEMENTADA**
* Apenas loga e alerta, mas não reverte o estoque
* Em caso de erro após dedução de estoque, os dados ficam inconsistentes

**Impacto:** Perda de integridade de dados de estoque em cenários de erro.

---

#### **C4. Falta de Validação de Entrada em Múltiplos Pontos**

**Exemplos:**

* `useOrderManagement.ts:82-87` - Desconto aplicado sem validação de limites
* `useCart.ts:70-74` - Desconto de item sem validação de teto
* `useConsumption.ts:20-27` - Preço unitário sem validação (pode ser negativo)

**Problema:** Valores podem ser manipulados sem validação adequada.

---

### **🟠 ALTO - Problemas Arquiteturais e Código Legado**

#### **A1. Duplicação de Lógica de Cálculo de Desconto**

**Localizações:**

* `lib/utils/price-calculations.ts:19-22` - `calculateItemTotal`
* `lib/hooks/useCart.ts:80-83` - `getItemTotal`
* `lib/hooks/useOrderManagement.ts:30-38` - cálculo inline

**Problema:** Mesma lógica implementada em 3 lugares diferentes.

**Exemplo:**

```typescript
// price-calculations.ts
export function calculateItemTotal(price: number, quantity: number, discountPercent: number = 0): number {
  const subtotal = price * quantity
  return subtotal * (1 - discountPercent / 100)
}

// useCart.ts
const getItemTotal = useCallback((item: POSCartItem) => {
  const subtotal = item.product.price * item.quantity
  return subtotal - (subtotal * item.discount / 100)
}, [])
```

**Impacto:** Risco de inconsistência se uma implementação for alterada e outras não.

---

#### **A2. Lógica de Negócio Espalhada Entre Hooks e Contextos**

**Problema:** Regras de negócio não estão centralizadas.

**Exemplos:**

* Validação de estoque em: `useCart`, `useStockControl`, `useStockIntegration`, `usePOSStockValidation`
* Cálculo de totais em: `useCart`, `useOrderManagement`, `price-calculations`
* Validação de desconto em: `useDiscount`, `validators`, `useBusinessRules`

**Impacto:** Dificulta manutenção e aumenta risco de bugs.

---

#### **A3. Thresholds Hardcoded com Valores Mágicos**

**Arquivo:** `lib/types/alerts.ts:56-77`

```typescript
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  stockCriticalLevel: 100,
  stockLowLevel: 150,
  cashDifferenceWarning: 50,
  cashDifferenceCritical: 100,
  withdrawalApprovalRequired: 500,
  openOrderWarningHours: 3,
  openOrderCriticalHours: 4,
  cashPaymentWarning: 200,
  changeMaximum: 50,
  yieldWarningPercentage: 90,
  yieldCriticalPercentage: 80,
}
```

**Problema:**

* Valores hardcoded que deveriam ser configuráveis por estabelecimento
* Alguns valores já são configuráveis via `SystemSettings`, mas thresholds não

---

#### **A4. Inconsistência na Estrutura de Dados**

**Problema:** Campos opcionais inconsistentes entre entidades similares.

**Exemplos:**

```typescript
// POSSale tem cancelReason
export interface POSSale {
  status: POSSaleStatus
  cancelReason?: string
}

// RestaurantOrder também tem cancelReason
export interface RestaurantOrder {
  status: OrderStatus
  cancelReason?: string
}

// Mas Reservation usa campo diferente
export interface Reservation {
  status: ReservationStatus
  cancelTreatment?: CancelTreatment // "estorno" | "multa" | "credito"
}
```

**Impacto:** Confusão conceitual e dificuldade de criar relatórios unificados.

---

#### **A5. Falta de Transações Atômicas**

**Problema:** Operações que deveriam ser atômicas são executadas em múltiplos passos sem garantia de atomicidade.

**Exemplo:** `useStockIntegration.ts:66-100`

```typescript
// Process all movements
for (const item of itemsToProcess) {
  await addStockMovement({...}) // Passo 1
  await updateStockItem(stockItem.id, { currentStock: newStock }) // Passo 2
}
```

**Impacto:** Se falhar no meio, dados ficam inconsistentes (alguns itens processados, outros não).

---

### **🟡 MÉDIO - Problemas de Manutenibilidade**

#### **M1. Excesso de Console.log/warn/error (43 ocorrências)**

**Problema:** Logging não estruturado espalhado pelo código.

**Exemplos:**

* `lib/app-context.tsx` - 5 console.log/error
* `lib/hooks/useStockControl.ts` - 5 console.error
* `lib/hooks/useStockIntegration.ts` - 4 console.error/warn
* `lib/data/storage-adapter.ts` - 11 console.error

**Impacto:** Dificulta debugging e não há sistema de logging estruturado.

---

#### **M2. Validações Incompletas**

**Arquivo:** `lib/utils/validators.ts`

**Problemas:**

* `validateExpense` não valida categoria
* `validateTransaction` não valida tipo ou categoria
* `validateStockItem` não valida unidade de medida
* Falta validação de CPF em `validateEmployee` (apenas verifica tamanho)

---

#### **M3. Falta de Documentação de Regras de Negócio**

**Problema:** Regras complexas sem documentação adequada.

**Exemplos:**

* Cálculo de custo médio em `useStockControl.ts:128-135` sem explicação
* Lógica de timeline de quartos em `store.ts:973-1048` complexa sem docs
* Regras de yield de produção sem documentação de origem dos percentuais

---

#### **M4. Tipos Duplicados e Inconsistentes**

**Problema:** Tipos similares definidos em múltiplos lugares.

**Exemplos:**

```typescript
// lib/utils/price-calculations.ts
export interface CartItem {
  product: { price: number }
  quantity: number
  discount?: number
}

// lib/store.ts
export interface POSCartItem {
  id: string
  product: POSProduct
  quantity: number
  discount: number
}
```

---

#### **M5. Falta de Testes Unitários para Regras de Negócio**

**Observação:** Não encontrei testes para:

* Cálculos de preço
* Validações
* Lógica de estoque
* Regras de desconto
* Cálculos de produção

---

### **🟢 BAIXO - Melhorias Recomendadas**

#### **B1. Uso de `any` em Metadados de Auditoria**

**Arquivo:** `lib/store.ts:266-273`

```typescript
metadata?: {
  before?: Record<string, any>
  after?: Record<string, any>
  [key: string]: any
}
```

---

#### **B2. Falta de Enums para Strings Literais**

**Problema:** Uso de strings literais em vez de enums.

**Exemplos:**

* Status de quartos: `"disponivel" | "ocupado" | "limpeza" | "bloqueado"`
* Métodos de pagamento: strings livres sem enum
* Tipos de movimentação: `"entrada" | "saida" | "ajuste" | "perda"`

---

#### **B3. Configurações de Ambiente Inconsistentes**

**Arquivo:** `lib/data/config.ts:44-51`

```typescript
const adapterType = (process.env.NEXT_PUBLIC_DATA_ADAPTER as AdapterType) || 'localStorage'
prefix: process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'pousada',
apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
```

**Problema:** Algumas configs têm fallback, outras não. Falta validação.

---

## 📊 ESTATÍSTICAS DA AUDITORIA

| Categoria                              | Quantidade |
| -------------------------------------- | ---------- |
| **Problemas Críticos**          | 4          |
| **Problemas Altos**              | 5          |
| **Problemas Médios**            | 5          |
| **Problemas Baixos**             | 3          |
| **Total de Problemas**           | 17         |
| **Arquivos Auditados**           | 73         |
| **Linhas de Código Analisadas** | ~15.000    |

---

## 🎯 RECOMENDAÇÕES PRIORITÁRIAS

**Legenda:**
- ✅ = Implementado completamente
- ⚠️ = Parcialmente implementado
- ❌ = Não implementado

### **Prioridade 1 - Segurança (Imediato)** 🔴

1. ❌ **Implementar hashing de senhas (bcrypt/argon2)**
   - Status: Senhas em texto plano em `lib/store.ts:916-939`
   - Evidência: `password: "adm123"` e `password: "1234"` sem hashing
   - Impacto: Comprometimento total do sistema de autenticação

2. ❌ **Remover senha hardcoded de supervisor**
   - Status: Senha hardcoded com fallback "admin" em `lib/utils/validators.ts:189`
   - Evidência: `const SUPERVISOR_PASSWORD = process.env.NEXT_PUBLIC_SUPERVISOR_PASSWORD || "admin"`
   - Impacto: Acesso privilegiado trivial para qualquer usuário

3. ❌ **Mover senha de supervisor para backend seguro**
   - Status: Senha exposta no bundle do cliente via `NEXT_PUBLIC_`
   - Evidência: Variável de ambiente com prefixo público
   - Impacto: Senha visível em código JavaScript do cliente

4. ⚠️ **Implementar rollback completo de estoque**
   - Status: Apenas stub com `console.warn` em `lib/hooks/useStockIntegration.ts:196-220`
   - Evidência: Comentário "In a real implementation, we would fetch the original movements"
   - Impacto: Inconsistências de dados em caso de erro

### **Prioridade 2 - Integridade de Dados (Curto Prazo)** 🟠

5. ⚠️ **Adicionar validações de entrada em todos os pontos críticos**
   - Status: Validações parciais e inconsistentes
   - Evidências:
     - ✅ `useCart.ts`: Valida estoque e quantidade > 0
     - ❌ `useOrderManagement.ts`: Não valida quantidade negativa/zero
     - ❌ `useConsumption.ts`: Não valida preço negativo ou string vazia
   - Impacto: Permite valores inválidos em pontos críticos

6. ⚠️ **Implementar transações atômicas para operações compostas**
   - Status: Padrão de compensação existe, mas sem atomicidade ACID
   - Evidência: Rollback manual via try/catch, sem transações de banco
   - Impacto: Operações podem falhar parcialmente deixando dados inconsistentes

7. ⚠️ **Centralizar lógica de cálculo de preços**
   - Status: Infraestrutura existe mas não é usada consistentemente
   - Evidências:
     - ✅ `lib/utils/price-calculations.ts`: Funções centralizadas disponíveis
     - ❌ `lib/hooks/useCart.ts:80-93`: Duplica lógica de cálculo
     - ❌ `lib/hooks/useOrderManagement.ts:50`: Cálculo inline
   - Impacto: Risco de inconsistência se uma implementação for alterada

### **Prioridade 3 - Arquitetura (Médio Prazo)** 🟡

8. ❌ **Criar camada de serviços para regras de negócio**
   - Status: Não existe `lib/services/` dedicado
   - Evidência: Regras espalhadas em hooks individuais (useBusinessRules, useStockIntegration, etc.)
   - Impacto: Dificulta manutenção e reutilização de lógica de negócio

9. ⚠️ **Consolidar validações duplicadas**
   - Status: Validações básicas centralizadas, validações de domínio duplicadas
   - Evidências:
     - ✅ `lib/utils/validators.ts`: Validações básicas centralizadas
     - ❌ Validações de estoque duplicadas em: useCart, usePOSStockValidation, useStockIntegration
   - Impacto: Manutenção complexa e risco de inconsistências

10. ❌ **Tornar thresholds configuráveis via SystemSettings**
    - Status: Thresholds hardcoded em `lib/types/alerts.ts`
    - Evidência: `DEFAULT_THRESHOLDS` com valores fixos, não persistidos em SystemSettings
    - Impacto: Impossível customizar thresholds por estabelecimento

### **Prioridade 4 - Qualidade (Longo Prazo)** 🟢

11. ❌ **Implementar sistema de logging estruturado**
    - Status: Apenas console.log/warn/error sem biblioteca
    - Evidência: 16.010+ ocorrências de console.* em todo o projeto
    - Impacto: Dificulta debugging e não há rastreabilidade estruturada

12. ⚠️ **Adicionar testes unitários para regras críticas**
    - Status: Cobertura mínima em v0-agi-pousada
    - Evidências:
      - ✅ mm3e-builder: 17 arquivos de teste, 2.427+ casos
      - ⚠️ v0-agi-pousada: Apenas 8 arquivos de teste básicos
      - ❌ Faltam testes para: cálculos de estoque, validações de reserva, regras de negócio
    - Impacto: Risco de regressões em mudanças futuras

13. ⚠️ **Documentar regras de negócio complexas**
    - Status: Documentação mínima com apenas 12 ocorrências de JSDoc
    - Evidência: Código de aplicação sem documentação adequada
    - Impacto: Dificulta onboarding e manutenção

14. ⚠️ **Substituir strings literais por enums**
    - Status: Schemas Zod existem, mas strings literais ainda presentes
    - Evidências:
      - ✅ mm3e-builder: Usa enums Zod (ComplicationTypeSchema, AbilityKeySchema)
      - ❌ v0-agi-pousada: Usa `Record<string, string>` para categorias
    - Impacto: Menor type-safety e risco de typos

---

## 📝 CONCLUSÃO

A aplicação possui uma **arquitetura funcional** com separação de responsabilidades, mas apresenta **problemas críticos de segurança** e **inconsistências arquiteturais** que precisam ser endereçados.

**Pontos Positivos:**

* ✅ Separação clara entre camadas (apresentação, lógica, dados)
* ✅ Uso de hooks customizados para encapsular lógica
* ✅ Sistema de alertas configurável
* ✅ Integração estoque-vendas implementada
* ✅ Auditoria de operações
* ✅ Infraestrutura de utilitários centralizados criada (price-calculations.ts, validators.ts, stock-validation.ts, date-formatting.ts)

**Pontos Críticos:**

* ❌ **Segurança de autenticação comprometida** (senhas em texto plano, senha hardcoded)
* ❌ **Rollback de estoque não implementado** (apenas stub com console.warn)
* ⚠️ **Lógica duplicada em múltiplos lugares** (infraestrutura existe, mas não é usada consistentemente)
* ⚠️ **Validações inconsistentes** (useCart valida, useConsumption não valida)
* ⚠️ **Testes automatizados insuficientes** (mm3e-builder bem coberto, v0-agi-pousada cobertura mínima)
* ❌ **Sistema de logging não estruturado** (16.010+ console.log/warn/error)
* ❌ **Thresholds não configuráveis** (hardcoded em alerts.ts)
* ❌ **Camada de serviços ausente** (regras espalhadas em hooks)

**Próximos Passos Sugeridos:**

### Fase 1: Segurança Crítica (Imediato) 🔴
1. Implementar hashing de senhas com bcrypt/argon2
2. Remover senha hardcoded de supervisor
3. Mover autenticação de supervisor para backend seguro
4. Implementar rollback completo de estoque

### Fase 2: Integridade de Dados (Curto Prazo) 🟠
5. Adicionar validações de entrada em useConsumption e useOrderManagement
6. Refatorar hooks para usar funções centralizadas de price-calculations.ts
7. Implementar transações atômicas com rollback compensatório

### Fase 3: Arquitetura (Médio Prazo) 🟡
8. Criar camada lib/services/ para regras de negócio
9. Consolidar validações de domínio duplicadas
10. Tornar thresholds configuráveis via SystemSettings

### Fase 4: Qualidade (Longo Prazo) 🟢
11. Implementar sistema de logging estruturado (winston/pino)
12. Expandir cobertura de testes em v0-agi-pousada
13. Adicionar JSDoc em funções de regras de negócio
14. Substituir strings literais por enums TypeScript

---

## 📊 RESUMO DO STATUS ATUAL

| Categoria | Total | ✅ Implementado | ⚠️ Parcial | ❌ Não Implementado |
|-----------|-------|----------------|-----------|---------------------|
| **Prioridade 1 - Segurança** | 4 | 0 | 1 | 3 |
| **Prioridade 2 - Integridade** | 3 | 0 | 3 | 0 |
| **Prioridade 3 - Arquitetura** | 3 | 0 | 1 | 2 |
| **Prioridade 4 - Qualidade** | 4 | 0 | 3 | 1 |
| **TOTAL** | **14** | **0** | **8** | **6** |

**Taxa de Implementação:** 0% completo, 57% parcial, 43% não iniciado

**Recomendação:** Priorizar Fase 1 (Segurança Crítica) imediatamente, pois os 3 problemas críticos de segurança representam riscos graves para a aplicação em produção.
