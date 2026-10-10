# Sprint 4 — compras e estoque de bebidas

**Data:** 10/10/2026 · **Escopo:** estoque único da pousada, somente bebidas.

Entrega técnica de COM-01–COM-04, COM-06–COM-09 e EST-01–EST-10. COM-05 continua condicional: pedido prévio e várias entregas do mesmo pedido não foram introduzidos. Recebimento confirmado em uma ação é o fluxo inicial. Aceite do cliente e atualização do computador operacional permanecem pendentes.

## Fluxos entregues

| Tela | Rotina |
| --- | --- |
| Estoque → Compras | Receber compra com fornecedor cadastrado, referência opcional, embalagem e fator, quantidades aceitas/recusadas, custo, lote/validade, frete, desconto e observações. A confirmação gera mercadoria, movimentos e uma obrigação financeira na mesma transação. |
| Compras → condição financeira | Vencimento único, parcelas cuja soma corresponde ao total ou pagamento à vista pelos meios existentes. Receber uma compra não concede permissão para pagá-la. Compra gratuita não gera dívida nem pagamento fictício. |
| Compras → histórico | Filtrar fornecedor e expandir documento para consultar itens/conversões, custos e lotes. Quem possui consulta de despesas vê pagamentos, saldo e parcelas da conta vinculada. A liquidação posterior permanece em Financeiro → Despesas. |
| Estoque → Lotes e validade | Consultar físico/utilizável, identificação, validade, custo restante e situação. Lote vencido, bloqueado ou sem revisão fica indisponível; permanece físico até descarte ou devolução. |
| Lotes → abertura/revisão | Supervisor registra mercadoria anterior à implantação ou confere o saldo legado preservado. A revisão não muda quantidade nem inventa data; precisa de motivo. A quantidade divergente é corrigida pelo inventário. Custos legados estimados ficam identificados. |
| Lotes → perda/devolução | Baixar quantidade de lote específico, inclusive vencido, com custo e motivo. Devolução exige lote de compra. Não gera abatimento ou reembolso automaticamente. |
| Compras → acordo de devolução | Supervisor registra abatimento da dívida/parcela pendente, reembolso realmente recebido até o limite já pago ao fornecedor, ou encerramento sem acerto financeiro. Um acordo por devolução, com valor e motivo preservados. |
| Estoque → Inventário | Capturar saldo por lote, contar e confirmar diferenças do corte. Uma contagem aberta por vez. Movimentos posteriores e novos lotes permanecem; ajuste que deixaria negativo é recusado integralmente. Cancelar a contagem não ajusta saldo. |
| Catálogo de bebidas | Configurar exigência de validade real. Recebimento não recalcula o preço de venda. Produto com lotes não pode perder controle de estoque nem ser movido para categoria do restaurante. |

Os formulários preservam o rascunho em falha. No celular usam a estrutura de tarefa com rolagem; listas de lotes/documentos usam cartões e detalhes expansíveis. Alterações chegam pela sincronização existente, com reconciliação periódica da consulta. Sessão/permissões diferentes limpam as consultas anteriores.

## Critérios de cálculo e integridade

- Quantidade-base = embalagens aceitas × fator preservado, com até três casas. Recusadas ficam documentadas, mas não entram no saldo ou no valor recebido.
- Mercadoria = aceitas × preço por embalagem. Total = mercadoria + frete − desconto; desconto nunca torna a compra negativa.
- Custo total é distribuído proporcionalmente ao valor dos itens aceitos, em centavos inteiros, com desempate determinístico dos resíduos. Em mercadoria gratuita com frete, usa a quantidade recebida. A soma dos custos é exatamente o total da compra.
- O lote conserva o valor restante em centavos e o custo histórico com seis casas. A retirada proporcional arredonda centavos; a última retirada leva todo o valor restante. O custo médio exibido é o valor físico restante dividido pela quantidade física, com duas casas. Custo de saída verificável fica nas alocações por lote, sem inferir pelo preço de venda.
- FEFO: lote aprovado com validade mais próxima primeiro; desempate por recebimento e identificação. Sem validade fica por último e só é utilizável em bebida que explicitamente não exige data. Vencimento usa a data operacional de São Paulo; vence ao final da data impressa, sem prazo calculado pelo aplicativo.
- Corte 20, contagem 18 e saída posterior 3: diferença −2 aplicada ao saldo atual 17, resultando em 15. Novos lotes fora do corte não são contados automaticamente.
- Estorno financeiro de venda não repõe mercadoria por padrão. Retorno físico explícito restaura o lote/custo da saída original; se estiver vencido ou bloqueado, continua indisponível. Correção de consumo já entregue não repõe bebida.
- Referência preenchida é única por fornecedor. Reenvio da mesma operação usa recibo idempotente; conta, lote, saldo e ledger não se duplicam.
- Documentos confirmados e movimentos não são editados/excluídos pelas APIs genéricas. Conta de compra só muda por pagamento ou acordo documentado; saldo/custo não podem ser sobrescritos. Motivos, executor e origem ficam na auditoria.

## Arquitetura e atualização

Mantido o monólito existente. `inventory-operations` coordena compras, abertura, perda, devolução e contagem; `inventory-stock` concentra projeção, alocação FEFO e retorno rastreado. Valores/conversões compartilhados ficam em `lib/inventory.ts`. Reutiliza transações serializáveis, retries, recibos, permissões, financeiro, auditoria, notificações e o canal de sincronização existentes. Nenhuma nova dependência ou serviço operacional.

Novas entidades normalizadas: compra/itens, lote, alocação de movimento, inventário/linhas e devolução. Compra origina uma despesa pelo vínculo único `sourcePurchaseId`. Lote é uma unidade rastreável; o saldo agregado anterior permanece como projeção compatível para telas e módulos arquivados.

Migração `20261011010000_sprint4_inventory` conserva os saldos anteriores de bebidas em lotes **pendentes de revisão**, sem validade inventada. O valor inicial usa o custo médio anterior, explicitamente estimado. Não transforma estoque do restaurante em estoque da pousada. Até conferir os lotes, esse saldo permanece físico e fica bloqueado para venda.

Exportação/restauração portátil inclui documentos, itens, lotes, alocações e cortes. Exportações completas anteriores à S4 são reconhecidas somente quando faltam as quatro coleções novas; seu estoque entra em abertura pendente. Importação parcial continua recusada. Relações e saldo são restaurados, sem reaplicar movimentos. Backup PostgreSQL inclui as novas tabelas.

### Como testar pelo painel

1. Encerre e use **Iniciar demonstração** para reconstruir a imagem atualizada e recriar o banco temporário. Usuário `teste`, senha `teste`. Dados operacionais não são usados.
2. Os exemplos incluem uma compra, embalagens recusadas, lotes fictícios, dívida do fornecedor e validade próxima. Abra Estoque → Compras e depois Lotes e validade.
3. Confira no cadastro da bebida sua unidade-base e política de validade. Defina mínimos em Configurações do estoque após existir saldo cadastrado.
4. Receba dois fardos de 12 a R$ 60 por fardo: resultado 24 unidades, custo total R$ 120 e uma conta de R$ 120. Pague depois em Financeiro → Despesas ou escolha à vista com sua permissão.
5. Faça uma perda, devolução e inventário apenas no ambiente de demonstração. Ao encerrar pelo painel, o banco temporário é descartado; a próxima inicialização restaura os exemplos.

Na instalação normal, faça backup antes de reconstruir/atualizar a imagem pelo procedimento documentado. A inicialização aplica migrações e atualiza as permissões restritas do banco, incluindo leitura de lotes pelo trabalhador de notificações. Não houve migração nem reinicialização do banco operacional durante esta implementação.

## Validação e limites

Testes locais de tipos, lint, cálculos e interface; conferência visual de celular e formulário desktop com dados fictícios, sem banco. CI isolado valida migração em saldo anterior, PostgreSQL, concorrência, restauração, painel Windows, dependências e imagem/inicialização de produção. O seed da demonstração é validado em `postgres-demo/pousada_demo`, criado e removido exclusivamente no CI.

Cobertura principal: AP-17–AP-23 e AP-27; recebimento idempotente, conversão e centavos, recusas, rollback de pagamento, parcelas, FEFO e vencidos, última unidade concorrente, corte/movimentos posteriores, devolução/acerto, estorno com retorno físico e preservação após restore.

Sem ordens de compra, múltiplos recebimentos por pedido, cozinha, armazéns, crédito corrente de fornecedor, anexos/documentos fiscais ou integração bancária. Um crédito de fornecedor só afeta dívida existente mediante acordo; não há carteira de créditos futuros. Serviços e gastos sem mercadoria continuam no cadastro de despesas. Não há alerta de cobrança automática ao fornecedor.

Painéis gerenciais de custo consumido/perdas/compras e critérios de resultados pertencem à S5. Os lançamentos de reembolso de fornecedor conservam sua origem; relatórios anteriores de entradas financeiras não devem ser lidos como receita de vendas ou margem contábil. Taxas/repasses de cartão e importação de extrato continuam no backlog explícito.
