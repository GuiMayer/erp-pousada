# Mapa da Migracao Relacional

Este documento define o alvo da migracao completa de dados para PostgreSQL relacional.

O objetivo e remover o uso produtivo de `local_data_entries` e de `localStorage` para dados de negocio. `LocalDataEntry` deve permanecer apenas durante a transicao e migracao de dados legados.

## Atualização cadastral da Sprint 1 — 09/10/2026

O esquema implementado acrescenta `customers.roles` e usa `customers.id` como identidade estável da pessoa/empresa. `guest_profiles.customerId` e `suppliers.customerId` são únicos e vinculados a essa identidade; a chave CPF do hóspede e seus créditos/referências antigas permanecem compatíveis. Documento normalizado não vazio é único. Não há fusão por nome.

A extensão de 10/10/2026 acrescenta `customers.companyId`, chave estrangeira opcional para outra linha de `customers`, indexada. PF tem no máximo uma empresa atual; PJ pagadora pode ter várias pessoas. Restrição e trigger impedem auto vínculo e tipos incompatíveis. O serviço exige empresa ativa para novo vínculo; vínculos existentes com empresa inativa continuam restauráveis. Importação cria empresas antes das pessoas. Pagador das reservas continua independente dessa relação cadastral.

`rooms.capacity` registra lotação; `lodging_tariffs` define preço por pessoa/noite, ocupação e vigência por categoria ou quarto. `reservations` guarda `guestCount`, `payerId`, `nightlyPrices` e `priceExceptionReason`; preços confirmados não são recalculados por mudança no cadastro. `pos_products` recebe unidade e situação, com barcode único quando informado.

A migration é aditiva, verifica duplicidades antes da alteração e não inventa capacidades/preços antigos. Consulte a [entrega da Sprint 1](ENTREGA_SPRINT_1.md) para estratégia, ativação e limites. As seções abaixo conservam a base anterior; hospedagem independente, compras e lotes continuam no alvo das etapas seguintes.

## Regras Gerais

- Banco novo de producao deve iniciar sem dados operacionais.
- Dados demonstrativos devem ser carregados somente por acao explicita.
- `localStorage` deve guardar apenas preferencias locais de interface ou modo demo.
- Toda mutacao critica deve passar por servico server-side transacional.
- Datas no dominio TypeScript continuam como string ISO; no Prisma devem ser `DateTime` quando houver valor temporal real.
- Valores financeiros devem usar `Decimal` no banco quando forem monetarios.
- Arrays de dominio devem virar tabelas filhas quando representam itens, parcelas, ingredientes ou historico.

## Administracao e Auditoria

Tabelas ja iniciadas:

- `users`
- `user_sessions`
- `system_settings`
- `audit_entries`

Regras:

- `users.username` deve ser unico.
- Senhas devem ser hash, nunca plaintext.
- `audit_entries` deve ser append-only no fluxo produtivo.
- Configuracoes administrativas devem ficar em `system_settings`, nao em localStorage.

## Hotel

Entidades:

- `Room`
- `Reservation`
- `GuestProfile`
- `RoomConsumption`
- `ConsumptionItem`

Tabelas alvo:

- `rooms`
- `reservations`
- `guest_profiles`
- `room_consumptions`
- `room_consumption_items`

Relacionamentos:

- `reservations.roomId -> rooms.id`
- `reservations.cpf -> guest_profiles.cpf`
- `room_consumptions.roomId -> rooms.id`
- `room_consumption_items.consumptionId -> room_consumptions.id`

Indices principais:

- `rooms.number` unico.
- `reservations(roomId, checkIn, checkOut, status)`.
- `guest_profiles.cpf` chave primaria.

Regras de negocio:

- Reserva ativa usa intervalo `[checkIn, checkOut)`.
- Reservas `confirmada` e `checkin` nao podem sobrepor no mesmo quarto.
- Check-out deve bloquear consumo pendente.

## Financeiro

Entidades:

- `Expense`
- `ExpenseInstallment`
- `Transaction`
- `CashClose`
- `ExpenseCategory`
- `Supplier`
- `Customer`
- `AccountReceivable`
- `AccountReceivableInstallment`
- `BankAccount`
- `BankTransfer`
- `CostCenter`
- `Budget`
- `BudgetCategory`
- `RecurringTransaction`

Tabelas alvo:

- `expense_categories`
- `suppliers`
- `customers`
- `expenses`
- `expense_installments`
- `transactions`
- `cash_closes`
- `accounts_receivable`
- `account_receivable_installments`
- `bank_accounts`
- `bank_transfers`
- `cost_centers`
- `budgets`
- `budget_categories`
- `recurring_transactions`

Relacionamentos:

- `expenses.supplierId -> suppliers.id` opcional.
- `expense_installments.expenseId -> expenses.id`.
- `transactions.accountId -> bank_accounts.id` opcional.
- `transactions.costCenterId -> cost_centers.id` opcional.
- `accounts_receivable.customerId -> customers.id`.
- `account_receivable_installments.accountReceivableId -> accounts_receivable.id`.
- `bank_transfers.fromAccountId -> bank_accounts.id`.
- `bank_transfers.toAccountId -> bank_accounts.id`.
- `budget_categories.budgetId -> budgets.id`.
- `recurring_transactions.accountId -> bank_accounts.id` opcional.

Regras de negocio:

- Despesa criada nao deve gerar transacao de caixa ate ser paga.
- Recebivel pago deve gerar transacao `receita` uma unica vez.
- Estorno deve seguir convencao unica: valor positivo e direcao definida por `type`.
- Fechamento de caixa deve usar transacoes, nao objetos de contas a pagar/receber pendentes.

## POS e Restaurante

Entidades:

- `ProductCategory`
- `POSProduct`
- `POSSale`
- `POSCartItem`
- `RestaurantTable`
- `RestaurantOrder`
- `RestaurantOrderItem`

Tabelas alvo:

- `product_categories`
- `pos_products`
- `pos_sales`
- `pos_sale_items`
- `restaurant_tables`
- `restaurant_orders`
- `restaurant_order_items`

Relacionamentos:

- `pos_products.categoryId -> product_categories.id`.
- `pos_sale_items.saleId -> pos_sales.id`.
- `pos_sale_items.productId -> pos_products.id`.
- `restaurant_orders.tableId -> restaurant_tables.id`.
- `restaurant_order_items.orderId -> restaurant_orders.id`.
- `restaurant_order_items.productId -> pos_products.id`.

Regras de negocio:

- Mesa so deve ficar `ocupada` depois do primeiro item na comanda.
- Comanda vazia pode ser fechada sem ocupar/liberar mesa.
- Pagamento de comanda cria transacao financeira e baixa estoque.
- Cancelamento exige motivo, auditoria e nao deve duplicar efeitos.
- Produto de restaurante deve ser identificado por `ProductCategory.isRestaurant`.

## Estoque e Producao

Entidades:

- `StockItem`
- `StockMovement`
- `Recipe`
- `RecipeIngredient`
- `Production`

Tabelas alvo:

- `stock_items`
- `stock_movements`
- `recipes`
- `recipe_ingredients`
- `productions`

Relacionamentos:

- `stock_items.productId -> pos_products.id`.
- `stock_movements.productId -> pos_products.id` e/ou `stock_items.productId`.
- `recipe_ingredients.recipeId -> recipes.id`.
- `recipe_ingredients.productId -> pos_products.id`.
- `productions.recipeId -> recipes.id`.

Regras de negocio:

- Movimento de estoque e atualizacao de saldo devem estar na mesma transacao.
- Venda/comanda/cancelamento deve criar movimentos compensatorios.
- Produto com `trackStock = true` deve falhar fechado se nao houver estoque suficiente.

## Funcionarios

Entidades:

- `Employee`
- `EmployeeConsumption`
- `EmployeeConsumptionItem`

Tabelas alvo:

- `employees`
- `employee_consumptions`
- `employee_consumption_items`

Relacionamentos:

- `employee_consumptions.employeeId -> employees.id`.
- `employee_consumption_items.consumptionId -> employee_consumptions.id`.
- `employee_consumption_items.productId -> pos_products.id`.

Regras de negocio:

- Consumo de funcionario deve auditar responsavel.
- Beneficio/desconto/pago deve impactar relatorio financeiro conforme configuracao definida.

## Ordem de Migracao Recomendada

1. Admin/auditoria.
2. Cadastros base: categorias, fornecedores, clientes, contas, centros de custo.
3. Hotel: quartos, hospedes, reservas, consumo de quarto.
4. Produtos/POS/restaurante.
5. Estoque/producao.
6. Financeiro transacional.
7. Funcionarios.
8. Script de migracao legado.
9. Remocao final de `LocalDataEntry`.

## Compatibilidade Temporaria

Durante a transicao, a API pode continuar expondo o contrato atual para o frontend. Internamente, cada chave antiga deve ser substituida por repositorio relacional equivalente ate que `local_data_entries` nao seja mais usada.
