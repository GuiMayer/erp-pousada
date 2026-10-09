# Sprints — pousada e venda de bebidas

**Revisão:** 09/10/2026 · **Base:** [modelagem 0.5](REQUISITOS_E_MODELAGEM_ERP.md).

O restaurante deixou de ser responsabilidade do ERP. Não haverá sprints de salão, cozinha, buffet, marmitas, contratos de refeições ou integração com o fornecedor externo. Cadastro de empresa pagadora e cobrança de hospedagem continuam essenciais.

A divisão é por fluxo utilizável, não por camada técnica. Reutilizar as funcionalidades existentes; implementar lacunas e validar os efeitos. Não reescrever autenticação, notificações, auditoria, concorrência ou banco sem uma necessidade concreta.

## Ordem e dependências

| Etapa | Entrega | Dependência | Demonstração de saída |
| --- | --- | --- | --- |
| S0 | Escopo pousada e modelagem recuperada | Nenhuma sprint nova. | Restaurante fora da interface e código preservado; mapa de requisitos e backlog. |
| S1 | Pessoas, bebidas, quartos e preços | S0. | Buscar cliente/empresa, definir pagador, cadastrar bebida e simular diária por pessoa/ocupação. |
| S2 | Hospedagem, conta e cobrança empresarial | Identidades e preços de S1. | Reservar/entrar, consumir, trocar quarto, sair com dívida empresarial e receber depois. |
| S3 | Frente de Caixa, caixa e financeiro | Origens e títulos de S2; controles existentes. | Vender bebida, lançar em hospedagem, receber por meios distintos, estornar e fechar turno sem duplicações. |
| S4 | Compra e estoque de bebidas | Catálogo de S1 e financeiro de S2/S3. | Receber fardo, gerar lote/saldo e conta a pagar, controlar validade/perda e inventário. |
| S5 | Relatórios, homologação e operação | Fluxos completos S1–S4. | Conferir números pela origem e recuperar instalação com dados e permissões reconciliados. |

S0 foi executada como retirada do restaurante e revisão documental; novas regras de S1–S5 não foram implementadas por esses commits. A ordem S3 antes de S4 evita ampliar compras sem ter um núcleo financeiro consistente. S2 inclui o título e o recebimento mínimos de sua dívida: a hospedagem empresarial não ficará entregue pela metade esperando outra sprint.

## S1 — Base cadastral e preços

**Objetivo:** estabelecer quem compra/paga, o que é vendido e como a diária é calculada, com telas simples para o primeiro protótipo.

- Buscar/cadastrar pessoa física ou empresa, com papéis de hóspede, pagador ou fornecedor; reutilizar cadastros e impedir duplicidade de documento normalizado.
- Definir identidade estável e plano de correspondência de CPF/CNPJ legados, preservando crédito/histórico. Não mesclar pessoas automaticamente por nome.
- Cadastro rápido usa a mesma identidade do cadastro completo; inativação não elimina relações anteriores.
- Consulta de CNPJ sob demanda, preenchimento conferido e alternativa manual. Falha do fornecedor externo não impede o protótipo nem o atendimento; serviço e validação serão verificados durante a implementação.
- Catálogo de bebidas com unidade, preço padrão, barcode opcional, situação e indicação de controle de estoque. Não introduzir ingredientes ou ficha técnica.
- Categoria/quarto com capacidade e tabela de preço **por pessoa/noite**, por ocupação e vigência; regra específica do quarto prevalece sobre categoria sem ambiguidades.
- Prévia por noite e ocupação, preço aplicado preservável e autorização para exceção; não recalcular reservas confirmadas quando preço de cadastro mudar.

**Aceitação principal:** AP-01–AP-06. Dados fictícios mostram um hóspede a R$ 120/pessoa/noite e dois a R$ 100/pessoa/noite, com totais R$ 120 e R$ 200 respectivamente. Confirmar que a busca e a simulação funcionam em celular e sem consulta externa disponível.

**Primeiro protótipo para o cliente:** cadastro/busca → quarto/ocupação → diária calculada → preço de bebida. Apenas valores e rótulos reais precisam ser conferidos na apresentação; o cliente não precisa decidir estrutura do banco.

**Limite:** S1 não promete ainda check-out empresarial novo, lotes ou compras integradas. O esquema da fatia e a estratégia de preservação dos documentos antigos precedem sua ativação.

## S2 — Hospedagem e cobrança empresarial completas

**Objetivo:** a conta pertence à estadia, e a dívida pertence ao pagador; nenhuma delas depende apenas do quarto físico.

- Relacionar reserva, acomodação, diárias acordadas por noite, hospedagem, ocupantes e pagador.
- Reutilizar disponibilidade, bloqueios, grupos atômicos, check-in e proteção de períodos; acrescentar ocupação/capacidade e preço estruturado.
- Check-in sem reserva cria origem consistente; grupo conserva referência comum sem exigir tela empresarial de contrato de refeições.
- Vincular consumo ao produto e à hospedagem, com preço histórico e origem da baixa; preservar extrato depois do pagamento.
- Troca de quarto verifica destino/período/capacidade, conserva hospedagem/conta e registra alocações; revisa somente diárias afetadas quando necessário.
- Extrato reúne diárias, bebidas, ajustes, sinal, crédito, pagamentos e saldo, sem contar sinal novamente como prestação.
- Check-out comum exige quitação. Prazo empresarial autorizado exige empresa pagadora, vencimento, dívida de origem e confirmação explícita; quarto passa à limpeza sem marcar valor recebido.
- Criar ou conservar títulos pelo saldo correto, receber parcial/total depois da saída e apresentar extrato de cobrança. Repetir saída/cobrança não gera outro título.
- Preservar cancelamento pago, no-show, multa, devolução/crédito e limites. Crédito pessoal legado não muda para a empresa pagadora sem tratamento autorizado.

**Aceitação principal:** AP-07–AP-13, AP-24, AP-27, AP-30. Especialmente: uma estadia encerrada com saldo de R$ 324 recebe R$ 100 depois e conserva R$ 224 em aberto; próxima entrada no mesmo quarto começa sem a conta anterior.

**Limite:** cobranças podem ser consultadas e registradas sem envio automático por WhatsApp/e-mail. O sistema do restaurante não participa desse fluxo. Migração de consumo por quarto não inventa identidade ausente nem executa estoque novamente.

## S3 — Caixa e financeiro integrados

**Objetivo:** consolidar as operações já existentes num fluxo consistente de bebida, cobrança, dinheiro e correção.

- Venda de bebida no PDV ou lançamento na hospedagem, com uma única origem de entrega/estoque/cobrança.
- Pagamento misto, troco exclusivamente em dinheiro, alocação de pagamento a parcelas/títulos e limite do saldo elegível.
- Identificação do pagador quando necessária; venda avulsa pode ser anônima. Venda avulsa a prazo e estorno parcial são condicionais a uso real e autorização.
- Preço no servidor, desconto acumulado e aprovação por operação; confirmação repetida retorna o efeito existente.
- Abrir/fechar turno com responsável, fundo, contagem e divergência; sangria/suprimento com origem/destino explícitos conforme regra do fluxo.
- Reaproveitar despesas/parcelas, recebimentos, contas e transferências; ligar estorno ao efeito original e respeitar meio/conta do reembolso.
- Separar devolução física de estorno financeiro; bebida já consumida não reaparece no estoque.
- Conferência manual de movimentos e saldos internos, sem exigir integração bancária nem apresentar saldo interno como conciliado.

**Aceitação principal:** AP-14–AP-16, AP-23–AP-28. Conta de R$ 100 com PIX R$ 40 e dinheiro R$ 70 devolve R$ 10 em dinheiro; caixa recebe líquido R$ 60 e a conta recebe R$ 40.

**Limite:** agenda de taxas/repasses de cartão e importação de extrato ficam no backlog explícito. A limitação do registro simplificado atual deve ser visível na documentação e nos indicadores pertinentes; não inferir que venda de cartão já foi conciliada com banco.

## S4 — Compras e estoque de bebidas

**Objetivo:** a entrada do fornecedor liga mercadoria, custo e conta a pagar numa confirmação.

- Documento de compra/recebimento com fornecedor, embalagem/conversão, unidades aceitas/recusadas, custo, frete/desconto, lote, validade e condição financeira.
- Confirmar atomicamente documento, entrada e obrigação, com pagamento à vista quando aplicável; não exigir outra despesa digitada para a mesma compra.
- Preservar fator da embalagem e custo aplicado; frete/desconto distribuídos devem reconciliar centavos.
- Recebimento parcial/pedido prévio só entram se usados na operação; rotina inicial permite receber a compra em uma ação.
- Lotes e saldo físico/utilizável, retirada pelo lote válido mais próximo do vencimento, alerta de validade/mínimo e bloqueio de vencido.
- Perda, devolução e ajuste autorizados com quantidade, origem, custo e motivo; acerto financeiro com fornecedor é independente da devolução física.
- Inventário por corte que preserve movimentos posteriores; proibir sobrescrita livre de saldo e estoque negativo concorrente.
- Histórico do fornecedor e das bebidas com entradas, custos e dívida; revisar preço de venda sem alteração automática pelo custo.

**Aceitação principal:** AP-17–AP-23 e AP-27. Dois fardos de 12 a custo total R$ 120 geram 24 unidades e custo R$ 5/unidade; resposta perdida não cria outros 24 itens nem outra dívida.

**Limite:** um estoque da pousada, somente bebidas. Sem cozinha, transferências entre negócios, produção, múltiplos armazéns ou prazo de validade calculado pelo aplicativo. Saldo legado sem validade requer tratamento de abertura explícito.

## S5 — Gestão, homologação e operação

**Objetivo:** conferir os números e provar que a instalação é operável e recuperável na máquina da pousada.

- Relatórios de ocupação/noites-quarto, diária média, diárias prestadas, bebidas, dívida empresarial e caixa, com critérios claros e origem clicável.
- Compras, custos consumidos, perdas e despesas separados; dados faltantes e estimativas identificados.
- Fluxo previsto simples de títulos a pagar/receber por vencimento, comparado ao realizado, sem integrar bancos automaticamente.
- Exportações gerenciais com filtros, período, totais e autorização preservados; nenhuma emissão fiscal.
- Homologação conjunta dos fluxos S1–S4 com aproximadamente cinco usuários, no equipamento final, medindo a meta de desempenho.
- Revisar mobile, teclado, foco, mensagens de falha, notificações e auditoria em cenários reais; não apenas aparência de telas.
- Instalação/atualização, inicialização, diagnóstico, backup em pasta configurável, retenção e restauração isolada. Tailscale continua opção externa do operador.
- Demonstrar que o banco temporário pode ser resetado sem afetar operação, usuários ou backup normal.

**Aceitação principal:** AP-29–AP-33, além de reexecutar os ciclos essenciais no equipamento alvo. Reconciliar saldos, documentos e permissões depois da restauração. RPO 24 h/RTO 4 h continuam propostas para a homologação, sem presumir aceite.

## Regras de conclusão que valem para todas as sprints

Uma sprint termina somente quando seu fluxo é demonstrável, os efeitos se reconciliam e a migração da fatia foi avaliada. Cada uma inclui autorização no servidor, auditoria, dados históricos preservados, transação, repetição segura, conflitos, falha de rede, atualização entre usuários, mobile afetado, documentação e commits por tarefa.

Antes de cada migração: mapa lógico da fatia, backup, ensaio isolado, relatório de duplicidades/diferenças e estratégia de recuperação. Os 262 testes existentes validam a base anterior; **não** comprovam os novos requisitos descritos aqui. Testes relevantes serão acrescentados ao implementar cada sprint.

Não deixar segurança, concorrência e mobile para S5. S5 verifica a instalação integrada e a recuperação, além de entregar os relatórios que dependem das operações novas.

## Backlog condicional ou de evolução

| Requisito | Decisão de prioridade | Tratamento |
| --- | --- | --- |
| COM-05 | Condicional mantido. | Pedido de compra e recebimento parcial somente se a rotina exigir; não bloquear entrada simples. |
| PDV-07 | Condicional. | Estorno parcial com itens/limites; evolução do fluxo atual após uso demonstrado. |
| FIN-05 | Evolução proposta, antes classificada N na versão 0.3. | Agenda de taxa/repasse e confirmação real do recebimento; arquitetura/origem preservadas, sem dizer que está pronto. AP-34 é o critério futuro. |
| FIN-10 | Evolução mantida. | Importação CSV com prévia e deduplicação; conferência manual cobre a primeira entrega. |
| FIN-11 | Evolução proposta, antes classificada N na versão 0.3. | Gerar títulos recorrentes com unicidade por período; não pagamento automático. AP-35 é o critério futuro. |
| Orçamento e centros de custo adicionais | Expansão adiada. | Preservar cadastros existentes; não prometer apuração integrada sem vínculo real. |
| Prazo avulso no PDV | Condicional. | Dívida empresarial de hospedagem é obrigatória em S2; crédito para venda avulsa não é inferido dessa confirmação. |

Essas decisões são propostas de priorização para manter o projeto viável; não são novas respostas do cliente. Revisar com exemplos no protótipo sem pedir decisões técnicas antecipadas. Requisitos arquivados não aparecem como tarefas ocultas nas sprints da pousada.

## Rastreabilidade por domínio

| Domínio | Telas/fichas | Requisitos | Sprint principal | Cenários |
| --- | --- | --- | --- | --- |
| Pessoas e preços | T01/T02 | CAD/PRE | S1; PRE-06 em S4. | AP-01–AP-06, AP-18 |
| Hospedagem e dívida | T03/T07 | HOS, FIN-01/02/03 | S2. | AP-07–AP-13, AP-24/27/30 |
| Bebidas/caixa | T04/T07/T08 | PDV, FIN-04/06/07/08/09/13 | S3. | AP-14–AP-16, AP-23–AP-28 |
| Compras/estoque | T05/T06 | COM/EST | S4. | AP-17–AP-23, AP-27 |
| Gestão/recuperação | T09 | REL, FIN-12 | S5. | AP-29–AP-33 |
| Qualidade | Todas | QUA-01–QUA-20 | Todas; medição e restauração integradas em S5. | Cenários de acesso, falha, concorrência, mobile e recuperação |
| Evoluções | T07/T08/T09 | FIN-05/10/11 | Backlog E, fora da primeira entrega. | AP-34/AP-35 e aceitação futura de importação |

O mapa individual dos requisitos da versão completa está na [auditoria de escopo](REVISAO_ESCOPO_MODELAGEM.md). Nenhuma estimativa de semanas foi assumida: duração depende da fatia, da migração e dos testes necessários. Preferir dividir uma sprint grande em tarefas coerentes, com seus próprios commits, a entregar um ciclo incompleto.
