# Sistema de Gestão de Pousada

Sistema completo de gestão hoteleira desenvolvido com Next.js, React e TypeScript. Oferece controle total de reservas, check-in/check-out, consumo, financeiro, PDV e auditoria.

## Funcionalidades Principais

### 1. Gestão de Quartos

- **Visualização em Grid**: Todos os quartos com status visual (disponível, ocupado, limpeza, bloqueado)
- **Check-in Rápido**: Modal de check-in com busca de hóspede por CPF
- **Check-out**: Processo completo com cálculo de consumo e pagamento
- **Lançamento de Consumo**: Sistema de PDV integrado para lançar itens consumidos
- **Histórico**: Visualização completa do histórico de cada quarto

**Status de Quartos:**
- Disponível (verde)
- Ocupado (vermelho)
- Limpeza (amarelo)
- Bloqueado (cinza)

### 2. Sistema de Reservas

- **Criar Reservas**: Formulário completo com dados do hóspede e período
- **Gerenciar Reservas**: Lista com filtros por status e período
- **Status de Reservas**:
  - Confirmada
  - Check-in realizado
  - Check-out realizado
  - Cancelada
  - No-show

### 3. Perfil de Hóspedes

- **Cadastro Automático**: Hóspedes são cadastrados automaticamente no primeiro check-in
- **Histórico de Estadias**: Número total de estadias por hóspede
- **Ticket Médio**: Cálculo automático do valor médio gasto
- **Alertas de No-show**: Identificação de hóspedes com histórico de não comparecimento
- **Busca por CPF**: Sistema inteligente de busca e auto-preenchimento

### 4. Consumo e PDV

- **Catálogo de Produtos**: Produtos organizados por categorias
- **Busca e Filtros**: Busca por nome e filtro por categoria
- **Itens Personalizados**: Possibilidade de lançar itens não catalogados
- **Cálculo Automático**: Total de consumo calculado em tempo real
- **Integração com Check-out**: Consumo é automaticamente incluído no check-out

**Categorias de Produtos:**
- Bebidas
- Alimentos
- Serviços
- Outros

### 5. Gestão Financeira

#### Receitas
- **Registro de Transações**: Todas as receitas são registradas automaticamente
- **Métodos de Pagamento**:
  - Dinheiro
  - Cartão de Débito
  - Cartão de Crédito
  - PIX
- **Relatórios**: Visualização de receitas por período e método

#### Despesas
- **Lançamento de Despesas**: Registro de todas as despesas operacionais
- **Categorias Customizáveis**: Crie e gerencie categorias de despesas
- **Aprovação de Supervisor**: Despesas acima de limite requerem aprovação
- **Anexos**: Possibilidade de anexar comprovantes

#### Fechamento de Caixa
- **Fechamento Diário**: Registro de abertura e fechamento de caixa
- **Conferência**: Comparação entre valores esperados e contados
- **Diferenças**: Identificação automática de divergências
- **Histórico**: Consulta de fechamentos anteriores

### 6. Sistema de Descontos

- **Descontos Configuráveis**: Defina limite máximo de desconto
- **Aprovação de Supervisor**: Descontos acima do limite requerem senha de supervisor
- **Cálculo Automático**: Valores com desconto calculados em tempo real
- **Auditoria**: Todos os descontos são registrados no log de auditoria

### 7. Auditoria e Logs

- **Registro Automático**: Todas as ações importantes são registradas
- **Rastreabilidade**: Usuário, ação, data e hora de cada operação
- **Filtros**: Busca por usuário, ação ou período
- **Exportação**: Possibilidade de exportar logs para análise

**Ações Auditadas:**
- Check-ins e check-outs
- Lançamentos de consumo
- Transações financeiras
- Aprovações de supervisor
- Alterações de status de quartos

### 8. Controle de Acesso

- **Dois Níveis de Usuário**:
  - **Operador**: Acesso às operações diárias
  - **Supervisor**: Acesso total + aprovações especiais

- **Autenticação**: Sistema de login com persistência de sessão
- **Permissões**: Ações sensíveis requerem nível de supervisor

**Usuários Padrão:**
- Operador: `operador` / senha: `1234`
- Supervisor: `supervisor` / senha: `admin`

### 9. Dashboard e Relatórios

- **Visão Geral**: Cards com métricas principais
- **Ocupação**: Taxa de ocupação em tempo real
- **Receita**: Receita total e por período
- **Despesas**: Total de despesas e categorias
- **Gráficos**: Visualização gráfica de dados financeiros

### 10. PDV (Ponto de Venda)

- **Gestão de Produtos**: CRUD completo de produtos
- **Categorias**: Organização por categorias
- **Preços**: Controle de preços unitários
- **Estoque**: (Preparado para implementação futura)
- **Vendas**: Registro de vendas avulsas (não vinculadas a quartos)

## Tecnologias Utilizadas

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + TypeScript
- **Estilização**: Tailwind CSS
- **Componentes**: shadcn/ui
- **Ícones**: Lucide React
- **Gerenciamento de Estado**: React Context API
- **Testes**: Vitest + React Testing Library
- **Validação**: Validadores customizados

## Arquitetura do Projeto

```
src/
├── app/                    # Páginas Next.js (App Router)
├── components/             # Componentes React
│   └── ui/                # Componentes UI reutilizáveis
├── lib/
│   ├── utils/             # Utilitários
│   │   ├── constants.ts   # Constantes do sistema
│   │   ├── formatters.ts  # Formatadores
│   │   ├── validators.ts  # Validadores
│   │   └── id-generators.ts # Geradores de ID
│   ├── hooks/             # Hooks customizados
│   │   ├── useCart.ts
│   │   ├── usePayment.ts
│   │   ├── useDiscount.ts
│   │   ├── useProductSearch.ts
│   │   ├── useGuestSearch.ts
│   │   └── useConsumption.ts
│   ├── app-context.tsx    # Contexto principal
│   ├── auth-context.tsx   # Contexto de autenticação
│   └── store.ts           # Tipos e dados iniciais
└── __tests__/             # Testes (158 testes)
```

## Componentes UI Reutilizáveis

- **CurrencyDisplay**: Exibição formatada de valores monetários
- **StatusBadge**: Badge de status com cores semânticas
- **DateDisplay**: Formatação de datas com ícone
- **DueDateDisplay**: Datas com alertas de vencimento
- **PaymentMethodBadge**: Badge de método de pagamento
- **StatCard**: Card de estatística para dashboard
- **SupervisorApprovalDialog**: Diálogo de aprovação com senha

## Hooks Customizados

- **useCart**: Gerenciamento de carrinho de compras
- **usePayment**: Processamento de pagamentos
- **useDiscount**: Cálculo e validação de descontos
- **useProductSearch**: Busca e filtro de produtos
- **useGuestSearch**: Busca de hóspedes por CPF
- **useConsumption**: Gerenciamento de consumo de quartos

## Instalação e Execução

### Pré-requisitos

- Node.js 18+ 
- pnpm (recomendado) ou npm

### Instalação

```bash
# Clone o repositório
git clone <repository-url>

# Entre no diretório
cd v0-agi-pousada

# Instale as dependências
pnpm install
```

### Executar em Desenvolvimento

```bash
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Executar Testes

```bash
# Rodar todos os testes
pnpm test

# Rodar testes em modo watch
pnpm test:watch

# Rodar testes com cobertura
pnpm test:coverage
```

### Build para Produção

```bash
# Criar build otimizado
pnpm build

# Executar build de produção
pnpm start
```

## Qualidade e Testes

- **158 testes** unitários e de integração
- **Cobertura de 100%** em utilitários, hooks e componentes UI
- **17 arquivos de teste** organizados por módulo
- **Testes de integração** para fluxos principais

### Executar Testes

```bash
pnpm test              # Rodar todos os testes
pnpm test:watch        # Modo watch
pnpm test:coverage     # Com cobertura
```

## Fluxos Principais

### Fluxo de Check-in

1. Selecionar quarto disponível
2. Clicar em "Check-in"
3. Informar CPF do hóspede (busca automática)
4. Preencher dados complementares
5. Confirmar check-in
6. Quarto muda para status "ocupado"

### Fluxo de Check-out

1. Selecionar quarto ocupado
2. Clicar em "Check-out"
3. Revisar consumo lançado
4. Aplicar desconto (se necessário)
5. Selecionar método de pagamento
6. Confirmar check-out
7. Quarto volta para status "disponível"

### Fluxo de Consumo

1. Selecionar quarto ocupado
2. Clicar em "Consumo"
3. Buscar produtos no catálogo ou adicionar item personalizado
4. Adicionar itens ao consumo
5. Itens são salvos automaticamente
6. Total é calculado em tempo real

## Otimizações de Performance

- **Memoização de Contextos**: `useMemo` nos providers para evitar re-renders
- **Callbacks Memoizados**: `useCallback` em todas as funções de contexto
- **Filtros Otimizados**: Memoização de listas filtradas
- **Componentes Leves**: Componentes UI sem lógica pesada

## Documentação Adicional

- [REFACTORING.md](./REFACTORING.md) - Documentação completa da refatoração
- [TEST_SUMMARY.md](./TEST_SUMMARY.md) - Resumo dos testes implementados

## Próximas Melhorias Sugeridas

- [ ] Integração com banco de dados real
- [ ] Sistema de relatórios avançados
- [ ] Exportação de dados (PDF, Excel)
- [ ] Gestão de estoque
- [ ] Integração com sistemas de pagamento
- [ ] App mobile
- [ ] Sistema de notificações
- [ ] Backup automático
- [ ] Multi-idioma

## Contribuindo

Este projeto foi desenvolvido com foco em qualidade, testabilidade e manutenibilidade. Ao contribuir:

1. Mantenha a cobertura de testes em 100%
2. Siga os padrões de código estabelecidos
3. Use os hooks e componentes existentes
4. Documente novas funcionalidades
5. Execute os testes antes de commitar

## Licença

Este projeto está sob a licença MIT.

## Suporte

Para dúvidas ou sugestões, abra uma issue no repositório.

---

Desenvolvido com Next.js e React
