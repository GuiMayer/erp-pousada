# Arquitetura de Dados e Plano de Migração (SQLite)

Com base nas melhores práticas da engenharia de software contemporânea e aproveitando a stack do projeto (Next.js 16 + React 19), este documento destrincha tecnicamente *como* migraremos do armazenamento volátil (`lib/app-context.tsx`) para o banco de dados persistente **SQLite**.

## 1. Problema Atual na Arquitetura
O sistema possui hoje o padrão chamado de *God Object Anti-pattern*, ou seja, um único Contexto React (`app-context.tsx`) armazenando o estado de 100% da aplicação na memória RAM do usuário. Isso resulta em:
- Perda imediata de dados no "F5".
- Alta lentidão ao escalar centenas de registros simultâneos.
- Falta de integridade referencial.

## 2. A Nova Arquitetura de Dados

### 2.1 Backend: Prisma ORM + Server Actions
Para manter o projeto em um único repositório fácil de gerir por uma empresa pequena:
- O banco local (`/prisma/pousada.db`) atuará como verdade absoluta.
- Em vez de expor uma API REST (endpoints estáticos `GET /api/rooms`), usaremos **Next.js Server Actions**. Elas contêm validação forte usando **Zod** garantindo segurança tipada de ponta a ponta.

### 2.2 Estrutura de Dados e Schema (Baseado em SQL Legado / Protótipo)

Abaixo projetamos o `schema.prisma` baseando-se no SQL que você forneceu e compatibilizando com as interfaces originais do código base (`lib/store.ts`). Como o SQLite não possui alguns dos tipos rigorosos do PostgreSQL (como `uuid` nativo e `timestamp with time zone`), o Prisma cuidará dessa conversão no background para o formato aceito pelo SQLite (strings e floats).

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // Ideal para o ambiente offline local
  url      = "file:./dev.db"
}

model Room {
  id               Int           @id @default(autoincrement()) // Origin: bigint GENERATED ALWAYS
  number           String
  type             String
  status           String        @default("disponivel")
  blockReason      String?       @map("block_reason")
  blockEndDate     DateTime?     @map("block_end_date")
  blockResponsible String?       @map("block_responsible")
  createdAt        DateTime      @default(now()) @map("created_at")

  reservations     Reservation[]
  
  @@map("rooms")
}

model Guest {
  cpf        String   @id
  name       String
  totalStays Int      @default(0) @map("total_stays")
  avgTicket  Float    @default(0.0) @map("avg_ticket") // Adaptado de numeric para Float em SQLite
  noShows    Int      @default(0) @map("no_shows")
  createdAt  DateTime @default(now()) @map("created_at")

  reservations Reservation[]

  @@map("guests")
}

model Reservation {
  id              String   @id @default(uuid()) // Origin: uuid_generate_v4()
  checkIn         DateTime @map("check_in")
  checkOut        DateTime @map("check_out")
  status          String   @default("confirmada")
  totalValue      Float    @default(0.0) @map("total_value")
  cancelTreatment String?  @map("cancel_treatment")
  createdAt       DateTime @default(now()) @map("created_at")

  // Foreign Keys mapping
  roomId          Int?     @map("room_id")
  room            Room?    @relation(fields: [roomId], references: [id])
  
  guestCpf        String?  @map("guest_cpf")
  guest           Guest?   @relation(fields: [guestCpf], references: [cpf])

  @@map("reservations")
}

model Expense {
  id          String   @id @default(uuid())
  description String
  category    String
  value       Float
  dueDate     DateTime @map("due_date")
  paid        Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("expenses")
}

model Transaction {
  id             String   @id @default(uuid())
  date           DateTime
  description    String
  value          Float
  type           String
  category       String?
  paymentMethod  String?  @map("payment_method")
  responsible    String?
  notes          String?
  refId          String?  @map("ref_id")
  createdAt      DateTime @default(now()) @map("created_at")

  @@map("transactions")
}

model Profile {
  id        String   @id @default(uuid()) // Fica isolado num sistema puramente SQLite e sem Auth.
  role      String   @default("operador")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("profiles")
}

// NOTA: Para total sincronia com suas views do protótipo, criaremos posteriormente estas tabelas complementares na Phase 1:
// - POSProduct
// - POSSale (e seus items)
// - CashClose (Fechamento de Caixa)
// - AuditLog (Logs da operação)
```
*O Prisma cuidará automaticamente dos vínculos, permitindo por exemplo fazer `db.room.findUnique({ include: { reservations: true } })` e puxar o histórico completo associado ao SQLite em milisegundos.*

### 2.3 Frontend: React 19 `useOptimistic` + Server Components
Um sistema de caixa/hotel exige tempo de resposta **imediato**.
- *Server Components:* As páginas carregarão os dados inicialmente do SQLite usando funções do Prisma.
- *Optimistic Updates:* Ao clicar em "Salvar", em vez de travar a tela em um `loading...`, usaremos o `useOptimistic()` do React. A interface muda instantaneamente enquanto a "Server Action" corre por fundo no banco.

---

## 3. Plano de Implementação (Passo a Passo)

### FASE 1: Infraestrutura de Dados (Data Layer Setup)
1. **Instalação:** Adicionar `prisma` e `@prisma/client`.
2. **Schema Design:** Aplicar o schema base listado na Seção 2.2 e complementar com tabelas faltantes para PDV e Logs.
3. **Migração do Seed Local:** Desenvolver `prisma/seed.ts` para puxar e preencher a DB nova com seu arquivo `seed-data.json`.

### FASE 2: Domain-Driven Server Actions
Dentro da pasta `/app/actions/`:
- Criar ações puras: `room-actions.ts`, `reservation-actions.ts`, etc.
- Validação forte injetando a ZOD já preexistente para cada formulário.

### FASE 3: Refatoração Gradual dos Contextos (Decoupling)
Esta é a fase onde quebramos o Monólito Global (`app-context.tsx`). As tabelas massivas na RAM viram buscas diretas atreladas à URL/Componente.

### FASE 4: Integração Híbrida do Front
Substituir no JSX final os "botões visuais" com o atrelamento real assíncrono para o Prisma via Next.js cache bypass.

## User Review Required

O modelo de dados (Schema Prisma) apresentado na seção 2.2 unifica perfeitamente a sua ideia SQL de produção com a base estática legada e as características do SQLite.

O plano atualizado agora possibilita que os próximos passos reais do projeto se iniciem. O seu OK nesse schema me permite avançar em definitivo com a **FASE 1**. Podemos prosseguir?
