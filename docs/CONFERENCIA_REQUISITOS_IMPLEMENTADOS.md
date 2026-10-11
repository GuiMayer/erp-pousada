# Conferência de implementação dos requisitos

**Data:** 11/10/2026 · **Base do código:** `9cbff82` (main, entrega S5) · **Fonte:** [modelagem funcional](REQUISITOS_E_MODELAGEM_ERP.md).

## Resultado

**Não está tudo implementado conforme a redação integral do documento.** As cinco sprints entregaram os fluxos centrais da pousada, mas restam lacunas de consulta/interface, projeção financeira e importação. Há também uma divergência entre o método de custo descrito na modelagem e o método efetivamente implementado. Entrega técnica não substitui ativação da versão ou aceite do cliente.

Dos **69 requisitos funcionais numerados da seção 8**, 64 são núcleo N. Nesta inspeção, 58 têm implementação identificada e seis estão parciais. Dois são condicionais e três são evoluções adiadas explicitamente. Essas contagens não incluem os 20 requisitos de qualidade, metas de homologação ou regras em prosa; não constituem porcentagem de prontidão para produção.

**Método:** leitura da modelagem, componentes, comandos/API, mapeadores, migrações, testes e entregas das sprints; conferência do [CI da main](https://github.com/GuiMayer/erp-pousada/actions/runs/38097714875), aprovado. A versão tem 342 testes unitários e 169 de integração, além de build, instalação Docker, recuperação e painel Windows. Não foi iniciado/reiniciado Docker/WSL local, alterado banco operacional ou realizado um novo ciclo visual completo nesta auditoria. Testes aprovados comprovam os cenários cobertos, não todos os enunciados do documento.

**Legenda:** I = implementação identificada no código, com evidência indicada; P = parcial; C = condicional adiado; E = evolução adiada; H = homologação/decisão operacional pendente. I não significa aceite comercial ou verificação exaustiva de todos os caminhos.

## Lacunas verificadas — ordem sugerida de fechamento

| Ordem | Requisito | Lacuna e consequência | Evidência direta |
| --- | --- | --- | --- |
| 1 | CAD-07 | Ficha mostra contas a receber e vínculo empresarial, mas não reúne hospedagens, pagamentos e crédito. “Valor pendente” soma o valor integral dos títulos pendentes/vencidos, sem subtrair `paidValue`; “Total pago” soma somente títulos quitados. Pagamento parcial pode deixar um resumo enganoso. Para usuário sem leitura financeira, a ficha não diferencia claramente indisponibilidade de ausência de dados. | `components/customers-management.tsx:637`, especialmente 677–694; só `customers`/`accountsReceivable` entram nesse componente. |
| 2 | PDV-01 | O carrinho mostra e pré-valida `currentStock` físico, apesar de o servidor fornecer `usableStock`. Pode anunciar quantidade vencida/bloqueada como disponível e só recusar na confirmação. O servidor FEFO protege a baixa; a lacuna é na informação antecipada ao operador. | `components/pos-tab.tsx:643`; `lib/utils/stock-validation.ts:43`; `lib/server/db/mappers.ts:358`; `lib/server/inventory-stock.ts:124`. |
| 3 | FIN-12 | Relatório mostra a pagar/a receber por vencimento e a diferença líquida, além de saldos atuais de contas. Não acumula saldo base + entradas previstas − saídas previstas em uma projeção de disponibilidade por dia; previsão separada de reservas também não foi identificada. Diferença de títulos não equivale a saldo projetado. | `lib/server/management-reports.ts:695`–745; `forecastNet` considera apenas títulos. |
| 4 | EST-09 | Alertas identificam produto/lote, mas o botão só abre a aba Estoque. Não seleciona o lote/produto nem a tarefa de revisão/reposição referenciada. | `lib/server/notifications/rules.ts:38`; `components/notification-center.tsx:41` usa `module`, sem encaminhar `reference` à tarefa. |
| 5 | CAD-02 | Busca por nome/documento existe e documento normalizado é único. Busca por telefone não está implementada na lista de pessoas nem no seletor de cadastro rápido. | `components/customers-management.tsx:95`; `components/customer-combobox.tsx:88`. |
| 6 | PRE-06 | Entrada conserva preço de venda e exibe custo, mas não há sugestão explícita de revisão do preço após mudança de custo do fornecedor. | `components/stock/purchase-receipt.tsx:356`; custo médio em `components/stock/stock-tab.tsx:185`; AP-18 testa preservação do preço, não essa sugestão. |
| 7 | QUA-19 | Restauração integral validada/transacional existe, assim como migrações de dados legados. Não há fluxo de importação inicial com prévia, registros aceitos/rejeitados e confirmação pelo operador. Restaurar um snapshot substitui o conjunto inteiro; não equivale a importar novos cadastros com revisão/deduplicação. | `app/api/data/import/route.ts`; `lib/server/db/relational-data-service.ts:347`; `scripts/migrate-local-data.ts`. |
| 8 | QUA-18 | Consulta CNPJ tem timeout de 8 s, limite de dez chamadas/minuto por usuário, conferência e alternativa manual. Não tem cache das respostas; consultas repetidas chamam o fornecedor novamente. | `lib/server/company-lookup.ts:9`; `app/api/companies/route.ts:6`; fetch `no-store`. |

Não é necessário abrir uma nova arquitetura para fechar esses pontos. São complementos aos módulos existentes, com testes dirigidos às lacunas.

## Divergência de regra a resolver deliberadamente

A seção 12 define **custo médio ponderado**, dizendo que retirada por validade não redefine a média. A S4 implementa **custo histórico por lote**: baixa FEFO consome o valor daquele lote; o campo `averageCost` é a média do valor dos lotes restantes dividida pelo saldo físico e muda conforme os lotes retirados. A S5 usa essas alocações reais para custo consumido/perdas.

Exemplo: lote A com 10 unidades a R$ 5 e B com 10 a R$ 10. Média inicial R$ 7,50; sair dez unidades de A custa R$ 50 no método implementado e deixa média R$ 10. Pelo custo médio de saída, custaria R$ 75 e deixaria média R$ 7,50. Ambos podem ser critérios gerenciais deliberados, mas não são a mesma regra.

Evidência: `lib/server/inventory-stock.ts:18` (`projectStock`), 53 (`lotMovement`) e 124 (`issueStock`); [entrega S4, critérios](ENTREGA_SPRINT_4.md). Não foi alterada a regra nesta auditoria. Deve haver decisão e revisão explícita do documento, ou adequação da implementação; não marcar equivalência automaticamente. Também não usar a média exibida como custo de uma venda histórica.

## Matriz dos requisitos funcionais

As referências S1–S5 abaixo apontam para `tests/integration/sprint1.test.ts` até `sprint5.test.ts`, suas migrações e os respectivos documentos `ENTREGA_SPRINT_n.md`. Evidência adicional está indicada quando o fluxo é anterior às sprints.

| ID | Estado | Implementação/evidência ou limite |
| --- | --- | --- |
| CAD-01 | I | Pessoas PF/PJ, papéis, fornecedor reaproveitado, empresa atual e membros. `contacts`, cadastros, S1 e `customer-company.test.ts`. |
| CAD-02 | P | Nome/documento e unicidade implementados; telefone ausente na busca. |
| CAD-03 | I | Venda anônima; ocupantes individuais e pagador empresarial separados. S2/S3. Prazo avulso continua condicional. |
| CAD-04 | I | CNPJ sob demanda, prévia conferida, preenchimento manual. `CnpjLookup`, `company-lookup`, testes de consulta/UI. |
| CAD-05 | I | Documento textual, CNPJ numérico/alfanumérico e CPF distinto. Validador e S1. |
| CAD-06 | I | Cadastro rápido usa Customer; inativação e vínculos preservados. S1. |
| CAD-07 | P | Ficha incompleta e resumo financeiro ignora pagamentos parciais. |
| CAD-08 | I | Unidade, categoria, controle de estoque/validade, situação e restrição pousada. S1/S4; item sem estoque não baixa lotes. |
| PRE-01 | I | Tarifa por ocupação, categoria/quarto e conflitos; preço padrão bebida. S1. |
| PRE-02 | I | Prioridade de quarto, exceção autorizada com motivo e preço salvo. `lodging-pricing`, S1/S2. |
| PRE-03 | I | Preço por noite/item preservado após reajuste. S1–S3. |
| PRE-04 | I | Desconto efetivo acumulado e aprovação vinculada. Comandos de operação e testes de desconto/acesso. |
| PRE-05 | I | Faixa/ocupação/vigência por pessoa/noite, capacidade e preço por noite. S1. |
| PRE-06 | P | Preço não muda automaticamente e custo é mostrado; sugestão de revisão ausente. |
| HOS-01 | I | Mapa físico e disponibilidade por período; proteção contra sobreposição em `operations`. |
| HOS-02 | I | Pagador, período, acomodação/ocupação e prévia de diárias. S1/S2. |
| HOS-03 | I | Grupo com referência comum, confirmação atômica e conflitos. `reserve-group`, testes de operações/concorrência. |
| HOS-04 | I | Stay/ocupantes e origem da reserva, inclusive entrada sem reserva. S2. |
| HOS-05 | I | Bebida/produto na hospedagem e baixa rastreada. S2/S4. |
| HOS-06 | I | StaySheet reúne diárias, charges, ajustes, sinais/payments e saldo. S2/S3. |
| HOS-07 | I | Troca valida destino, conserva ID e registra alocações. S2. |
| HOS-08 | I | Quitação comum ou prazo empresarial explícito; quarto para limpeza. S2. |
| HOS-09 | I | Cancelamento/no-show com motivo, multa e destino do saldo. Comandos e testes de regras; legado conservado. |
| HOS-10 | I | Crédito por operações/origem, sem edição genérica; crédito pessoal não quita empresa implicitamente. S1/S2. |
| HOS-11 | I | Título de origem e recebimento posterior/parcial, saldo preservado. S2/S3. |
| PDV-01 | P | Nome/barcode/preço e serviço sem baixa; saldo exibido/pré-validado é físico. |
| PDV-02 | I | Preço/quantidade/desconto por linha e recálculo no servidor. S3, comandos de venda. |
| PDV-03 | I | Venda/estoque/recebimento atômicos; opção hospedagem sem dupla cobrança. S3/S4/S5. |
| PDV-04 | I | Cliente identificado quando exigido; avulsa anônima. Prazo fora da hospedagem não foi incluído por ser condicional. |
| PDV-05 | I | Misto, alocação líquida e troco somente dinheiro. S3. |
| PDV-06 | I | Histórico e origens de venda/lançamento/estorno; retorno físico explícito. S3/S4. |
| PDV-07 | C | Estorno parcial por item/valor adiado; estorno integral com decisão física implementado. |
| COM-01 | I | Formulário único, fornecedor, conversão, lote, recusa e condição financeira. S4. |
| COM-02 | I | Recebimento/entrada/obrigação atômicos e à vista pela mesma obrigação. S4. |
| COM-03 | I | Fardo/caixa e fator histórico preservado. S4. |
| COM-04 | I | Rateio de frete/desconto com reconciliação de centavos. S4. |
| COM-05 | C | Pedido prévio e múltiplas entregas do pedido adiados. |
| COM-06 | I | Recusados registrados, sem saldo nem dívida indevidos. S4. |
| COM-07 | I | Lote de compra, devolução e acordo financeiro independente. S4. |
| COM-08 | I | Despesa sem estoque; recebimento gera conta vinculada. S3/S4. |
| COM-09 | I | Compras filtradas por fornecedor, itens/preços/lotes e conta/pago/saldo com acesso de despesas. `InventoryWorkspace`, S4. Não depende de a ficha cadastral do fornecedor conter esse histórico. |
| EST-01 | I | Físico e utilizável por produto/lote; método de valor declarado na S4. Divergência com seção 12 registrada acima. |
| EST-02 | I | Exigência de validade real e lote, abertura/revisão de saldo legado. S4. |
| EST-03 | I | FEFO somente utilizável; vencido não supre venda. S4. |
| EST-04 | I | Baixa uma vez na entrega, não no pagamento. S2/S3/S4. |
| EST-05 | I | Restaurante excluído e bloqueado para estoque pousada. `stockProduct`, S4. |
| EST-06 | I | Perda/ajuste com motivo/executor/origem; APIs não sobrescrevem saldo livremente. S4. |
| EST-07 | I | Contagem por corte e delta aplicado ao saldo corrente, sem perder saídas posteriores. S4. |
| EST-09 | P | Mínimo/validade identificados; alerta abre módulo, não tarefa/registro. |
| EST-10 | I | Última unidade concorrente protegida e negativo recusado. S4. |
| FIN-01 | I | Títulos/parcelas e origem de hospedagem/compra. S2/S3/S4. |
| FIN-02 | I | Alocações parciais e saldo pelo valor pago. S3. Resumo da ficha CAD-07 ainda diverge. |
| FIN-03 | I | Sinal/crédito/origem e utilização sem dinheiro fictício. S2/S3. |
| FIN-04 | I | Dinheiro com turno aberto, PIX em conta. `business-finance`, S3. |
| FIN-05 | E | Taxa/líquido/agenda/repasse não implementados. Registro simplificado e limite identificados na interface/documentação. |
| FIN-06 | I | Turno, suprimento/sangria e contrapartida identificada. S3. |
| FIN-07 | I | Contagem/divergência preservadas e autorização. S3. |
| FIN-08 | I | Transferência atômica e sem receita/despesa. S3/S5. |
| FIN-09 | I | Conferência manual por movimento, executor/data/nota sem alterar saldo. `TransactionCheck`, `check-transaction`, S3; não é conciliação automática/importada. |
| FIN-10 | E | Importação de extrato CSV com deduplicação adiada. |
| FIN-11 | E | Cadastro de recorrência existe; gerador único por período adiado. |
| FIN-12 | P | Títulos previstos e saldos atuais existem; saldo projetado acumulado/previsão de reservas ausentes. |
| FIN-13 | I | Reversões com origem e limite, separadas de retorno físico. S2/S3/S4. |
| REL-01 | I | Prestação/venda, recebimento, custo e saldos separados. S5. |
| REL-03 | I | Noites-quarto, ADR, diárias/bebidas e dívida; ocupação pelo catálogo atual explicitamente limitada. S5. |
| REL-04 | I | Utilizável, valor/lotes, mínimo, perdas/movimentos. S4/S5. |
| REL-05 | I | Resultado parcial separa atividade/custo/despesa e não desconta compra duas vezes. S5. |
| REL-06 | I | CSV/JSON filtrados com origem/critérios/totais, autorização e auditoria. S5. |
| REL-07 | I | Detalhamento/origem consultável e custos ausentes/estimados. S5. |

IDs ausentes, como EST-08 e REL-02, permanecem ausentes por destinação anterior do escopo; não são requisitos esquecidos. PO-01–PO-20 são índice dos mesmos assuntos, não vinte entregas adicionais. Modelos conceituais não exigem uma tabela por entidade; grupos e projeções podem satisfazer responsabilidades sem nomes idênticos.

## Qualidade e operação

| ID | Estado | Evidência/pendência |
| --- | --- | --- |
| QUA-01 | I | Transações serializáveis, rollback de pagamento/recebimento e testes S2–S4. |
| QUA-02 | I | Recibos por requestId e reenvios idempotentes; comandos/S3/S4. |
| QUA-03 | I | Versões, retries e estoque/disponibilidade/crédito protegidos; testes concorrentes. |
| QUA-04 | I | API por ação/coleção, relatórios/origens/exportações e testes de acesso direto. |
| QUA-05 | I | Auditoria do servidor com origem/executor e dados controlados; testes de auditoria/operações. |
| QUA-06 | I | Calendário civil/fuso operacional e testes de virada/limite S5. |
| QUA-07 | H | Core usa servidor local; CNPJ é opcional. Ciclo com internet desligada na rede/equipamento final ainda deve ser feito. |
| QUA-08 | P/H | Rascunhos e identidade de reenvio existem em fluxos críticos, com testes; ciclo completo de resposta perdida/rede real T03/T04/T05 pendente. |
| QUA-09 | I/H | Sincronização, versões/comparação e refresh; testes. Confirmar cinco sessões reais sem interromper rascunhos. |
| QUA-10 | I/H | Português, identificação de demonstração e mensagens de estado; compreensão pelo funcionário exige apresentação/aceite. |
| QUA-11 | P/H | Componentes mobile/teclado, testes e inspeções pontuais existem. Não houve homologação de todas as fichas em celular real. |
| QUA-12 | P/H | Controles principais com meta de 44 px e estados textuais; inspeção integral de dimensões/contraste/foco pendente. |
| QUA-13 | H | Ensaio CI de cinco identidades/30 operações aprovado. P95 de 2 s na máquina final, volume representativo, não está homologado. |
| QUA-14 | I/H | Backup, segunda pasta, retenção, restore isolado com fingerprints e invariantes. Executar com backup real da instalação alvo. |
| QUA-15 | H | RPO 24 h/RTO 4 h são propostas; faltam tolerância aceita, teste de recuperação completa e confirmação da cópia fora da máquina. |
| QUA-16 | I | Banco/volumes/credenciais demo isolados, guard e manifesto antes/depois do reset. CI e scripts demo. |
| QUA-17 | I/H | Acesso restrito e proteção de dados nos logs/exportações; prazo de retenção e revisão final de campos pessoais pendentes. |
| QUA-18 | P | Timeout/rate limit/manual existem; cache de consulta CNPJ ausente. |
| QUA-19 | P | Validação/restauração/migração existem; importação inicial com prévia/rejeições não. |
| QUA-20 | I/H | Monólito, painel, guias, build/instalação/backup CI. Testar inicialização/atualização/recuperação na máquina final. |

## Cenários e prontidão

- **AP-01–AP-32:** existem testes relacionados aos ciclos centrais, conforme as entregas e suítes. Essa cobertura não comprova toda a redação dos requisitos vinculados: por exemplo AP-18 conserva preço de venda, mas não testa uma sugestão de revisão; AP-32 restaura cópia, mas não entrega o importador com prévia QUA-19.
- **AP-33:** verificação mobile/falha integral com cliente continua pendente. Inspeções com fixtures e testes de componente não substituem rede/celular real.
- **AP-34/AP-35:** cartão e recorrência são cenários futuros, deliberadamente fora da primeira entrega. Importação bancária FIN-10, COM-05 e PDV-07 também permanecem no backlog.
- **Ativação:** atualização/migrações na instalação do cliente, revisão de saldos legados, preços/políticas reais e cópia externa verificável continuam dependências de operação; a aprovação do código não atesta que o servidor em uso está nessa versão.

## Ajustes necessários no documento

O cabeçalho ainda registrava somente S1–S4, enquanto S5 já estava descrita ao final. A seção 4 é um diagnóstico anterior às sprints e contém frases como “tarifa ainda não aparece” e “hoje exige quitação”, já superadas; deve ser lida como histórico, não estado atual. Os documentos individuais de entrega mantêm limites e contagens de sua data, não inventário atual consolidado.

Nesta auditoria, o cabeçalho e o contexto dessa seção foram esclarecidos, preservando os requisitos. Nenhuma lacuna foi removida do escopo para fabricar conclusão. Não foram implementadas correções funcionais, nem alterada a regra de custo.
