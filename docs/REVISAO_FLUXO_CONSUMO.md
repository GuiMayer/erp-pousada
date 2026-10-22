# Revisão do consumo, pagamento e check-out

Data: 22/10/2026. Revisão posterior à unificação da venda do PDV.

## Resultado

Os cenários verificados com PostgreSQL passaram. A demonstração no navegador ainda possui caminhos de consumo anteriores à unificação do PDV e não pode ser considerada equivalente ao banco nesses casos. Esta revisão acrescenta testes completos; não corrige os problemas encontrados abaixo.

## Fluxo esperado e verificado no PostgreSQL

| Etapa | Cobrança | Estoque |
| --- | --- | --- |
| Venda recebida no PDV | Recebimento vinculado à venda; nenhum débito na hospedagem | Baixa na entrega |
| Venda marcada na ficha | Cobrança vinculada à venda e à hospedagem; nenhum recebimento no PDV | Baixa na entrega |
| Produto adicionado diretamente no consumo | Cobrança na hospedagem pelo preço validado no servidor | Baixa na entrega |
| Pagamento parcial ou quitação | Lançamentos financeiros e alocação entre diárias/consumo; quitação usa o saldo restante | Nenhuma nova baixa |
| Check-out quitado | Encerramento sem novo recebimento | Nenhuma nova baixa |
| Check-out empresarial a prazo | Título apenas pelo saldo, sujeito a autorização | Nenhuma nova baixa |
| Correção de consumo manual | Corrige a cobrança; bloqueia valor já recebido | Sem retorno físico automático |
| Estorno de venda marcada | Corrige cobranças da venda; bloqueia consumo recebido ou estadia encerrada | Retorno somente se explicitamente solicitado |

Foram executados os 11 testes de integração de `tests/integration/sprint3.test.ts`, no PostgreSQL isolado `erp_test`. Dois cenários novos cobrem a sequência completa:

- Diárias de R$ 400, consumo direto de R$ 24 e entrega do PDV de R$ 36: pagamento parcial de R$ 420, quitação dos R$ 40 restantes, repetição da confirmação e check-out. Recebimento total de R$ 460 e estoque de 10 para 5 unidades, preservado após receber e encerrar. O saldo do lote também permanece em 5.
- Venda de R$ 36 recebida no PDV: não entra no consumo da hospedagem. Pagamento dos R$ 424 da hospedagem e check-out conservam o total financeiro de R$ 460 e o estoque de 5 unidades.

Os testes também cobrem pagamento misto, troco líquido, repetição do mesmo comando, concorrência de recebimentos, estorno com retorno opcional, cortesia sem entrada fictícia e bloqueio de remoção direta de item originado no PDV. Esses resultados cobrem os cenários descritos, não constituem uma garantia universal de ausência de falhas.

## Problemas da demonstração no navegador

### 1. Quitação após pagamento parcial pode registrar receita excedente

Reproduzido usando os serviços reais da demonstração e o cálculo da tela de consumo. Um consumo de R$ 10 recebe R$ 5 pelo extrato. A projeção dos itens ainda soma R$ 10, e `ConsumptionSheet.payConsumption` registra esse valor inteiro antes de chamar `clearConsumption`, que reconhece somente os R$ 5 restantes como pagamento. No cenário de teste, deveriam entrar R$ 710 (R$ 700 de diárias pendentes e R$ 10 de consumo), mas entram R$ 715. A ficha termina com saldo zero e esconde a divergência no financeiro.

Origem: `components/consumption-sheet.tsx`, `payConsumption`; `lib/data/demo-stays.ts`, `demoConsumptionCorrection`.

### 2. Pagamento misto da hospedagem ignora a divisão entre os meios

Reproduzido: uma quitação de R$ 710 dividida em PIX de R$ 700 e dinheiro de R$ 10 acrescenta R$ 710 ao banco. `demoStayOperation` considera `paymentMethod` e `value`, ignorando as linhas de `payments`. Se não houver `paymentMethod`, a operação pode ser recusada mesmo com linhas válidas.

Origem: `lib/data/demo-stays.ts`, ramo `stay-receive`/`receive-account`.

### 3. Item de venda pode ser corrigido diretamente pela ficha

Reproduzido: `demoConsumptionCorrection` aceita a remoção de uma cobrança com `sourceSaleId`. No PostgreSQL essa ação é bloqueada e exige estorno da venda. A demonstração permite retirar a cobrança mantendo a venda como concluída, quebrando a conciliação entre os registros. Essa remoção não devolve estoque por si só.

Origem: `lib/data/demo-stays.ts`, `demoConsumptionCorrection`.

### 4. Consumo de catálogo lançado diretamente não baixa estoque na demonstração

Identificado por leitura do código: o ramo demonstrativo de `AppProvider.addConsumptionItem` grava a projeção de consumo e reconcilia a hospedagem, sem criar movimento ou reduzir o saldo de estoque. Esse caminho é diferente da venda do PDV, cuja baixa está implementada. Não foi executada uma entrega adicional pela interface para este achado.

Origem: `lib/app-context.tsx`, `addConsumptionItem`.

## Ordem recomendada de correção

1. Usar o saldo de consumo da hospedagem para quitar e gerar recebimento e alocação juntos, eliminando a criação financeira separada da limpeza da projeção.
2. Fazer os recebimentos demonstrativos respeitarem todas as linhas de pagamento, os respectivos destinos e o caixa aberto, em transação isolada compartilhada com o PDV.
3. Impedir correção direta de cobranças originadas em venda; usar o estorno vinculado, com retorno físico opcional.
4. Levar o lançamento direto de produtos para um comando que valide hospedagem, preço, permissão e estoque antes de publicar a entrega.
5. Repetir os mesmos cenários de venda, parcial, quitação e check-out nos dois modos, incluindo tentativas concorrentes e repetição após falha de resposta.

A revisão usou dados fictícios e o banco isolado de testes. Os três defeitos reproduzidos na demonstração foram exercitados em armazenamento temporário de teste, sem alterar o armazenamento da página aberta. Nenhum banco operacional foi usado.
