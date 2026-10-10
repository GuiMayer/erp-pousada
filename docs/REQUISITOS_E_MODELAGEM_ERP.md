# Requisitos e modelagem funcional — ERP Pousada

**Versão:** 0.8 · **Data:** 10/10/2026 · **Escopo ativo:** pousada e bebidas · **Situação:** referência para protótipo e sprints; S1/S2 implementadas, aceite do cliente pendente.

Requisitos e entidades abaixo descrevem o alvo; não significam implementação de todas as sprints. A revisão 0.5 restaurou o detalhamento relevante para a pousada, com regras, telas, cardinalidades, transições, cálculos e aceitação. A revisão 0.6 registra a [entrega da Sprint 1](ENTREGA_SPRINT_1.md), preservando integralmente os requisitos das etapas seguintes.

A revisão 0.7 acrescenta o vínculo opcional da pessoa física à empresa atual, a lista de funcionários na ficha da empresa e sua sugestão como pagadora em novas hospedagens. Mantém todos os requisitos anteriores. Esse cadastro não representa o quadro de funcionários da pousada nem um módulo de recursos humanos.

O [plano das sprints](SPRINTS_POUSADA.md) define a sequência de entrega. A [auditoria de escopo](REVISAO_ESCOPO_MODELAGEM.md) dá uma destinação explícita a cada requisito numerado da versão completa. A [versão 0.3 integral](../modules/abandoned/restaurant/docs/REQUISITOS_POUSADA_E_RESTAURANTE.md) permanece preservada como referência histórica, sem autoridade sobre o escopo ativo.

A revisão 0.8 registra a [entrega da Sprint 2](ENTREGA_SPRINT_2.md): hospedagem independente do quarto, ocupantes, histórico de acomodações, extrato preservado e título empresarial com recebimento posterior. Não remove requisitos, cenários ou decisões das sprints seguintes.

## 1. Contexto, confirmações e limites

| Tema | Decisão e consequência |
| --- | --- |
| Operação | Pousada pequena, equipe de aproximadamente cinco funcionários; uma pessoa pode acumular funções com sua própria conta. |
| Restaurante | Cliente contratou outro sistema. Mesas, comandas, cozinha, buffet, marmitas, consumo de funcionários e contratos de refeições ficam arquivados. |
| Caixa e contas | Cliente confirmou caixas e contas separados entre pousada e restaurante. Não modelar caixa compartilhado entre sistemas, rateio entre negócios nem transferência implícita. |
| Hospedagem | Diária por pessoa; preço varia por quarto e quantidade de hóspedes. Guardar ocupação e preço por pessoa aplicados em cada noite. |
| Empresa pagadora | Algumas pagam após a saída. Encerrar hospedagem e liberar quarto para limpeza sem dar baixa fictícia na dívida. |
| Bebidas | Frente de Caixa permanece; estoque operacional da pousada é de bebidas, com preço padrão cadastrado. |
| Cancelamento pago | Supervisor define multa e destinação do saldo, com devolução ou crédito e histórico. |
| Fiscal | Sem funções fiscais nesta etapa; recibo e demonstrativo gerenciais não são emissão fiscal. |
| Interface | Manter o estilo; organizar tarefas e dados. Reutilizar componentes e evitar telas extras sem necessidade. |
| Operação técnica | PostgreSQL e Docker no computador da pousada; demonstração isolada e descartável; backup em pasta configurável. Tailscale é opção externa descrita no guia, não dependência oficial. |

Não inferir um CNPJ por unidade operacional. Não construir integração com o sistema externo do restaurante sem solicitação posterior. As respostas sobre refeições foram [arquivadas](../modules/abandoned/restaurant/docs/RESPOSTAS_DO_CLIENTE.md).

Detalhes de valores reais, crianças, horários, café incluído, tolerâncias, prazo empresarial e ocupação devem ser parametrizados ou mostrados no primeiro protótipo. Não solicitar ao cliente decisões sobre tabelas, serviços ou arquitetura. Esta revisão não abre nova rodada de perguntas antes do protótipo.

## 2. O que a revisão da versão 0.4 encontrou

A versão 0.4 tinha 20 requisitos resumidos PO-01–PO-20 e um diagrama agregado. Eles não substituíam o detalhamento das seções anteriores. A principal perda foi de especificação e rastreabilidade, embora o arquivo completo não tenha sido apagado.

| Assunto | Tratamento nesta versão |
| --- | --- |
| Consumo por hospedagem, troca de quarto e sucessão de hóspedes | Identidade estável da hospedagem, alocações de quartos e lançamentos vinculados; não usar número de quarto como conta definitiva. |
| Tarifa por pessoa/ocupação e preço por noite | Fórmula, prioridade, capacidade e retrato histórico restaurados. |
| Pagador, hóspedes e empresa | Vínculos distintos; cadastro reaproveitado, sem CPF/CNPJ como chave técnica do novo histórico. |
| Obrigações, recebimentos e dinheiro | Título, parcela, alocação e movimento com origens explícitas; cobrança não cria segunda venda. |
| Compras, conversões, lotes e inventário | Documento de recebimento, dívida automática, validade, custo e ajuste com corte definidos. |
| Estados, correção e cancelamento | Transições e efeitos físicos/financeiros restaurados, inclusive dívida depois da saída. |
| Qualidade, migração e operação | Concorrência, resposta perdida, autorização, acessibilidade, restauração e transição verificável detalhadas. |
| Agenda de cartão, recorrências e importação de extrato | Preservadas como evoluções explícitas, com justificativa; não apagadas nem apresentadas como já existentes. |
| Integração entre pousada/restaurante | Arquivada, com os requisitos exclusivamente do restaurante. |

## 3. Decisões de desenho

| ID | Decisão deliberada | Implicação |
| --- | --- | --- |
| DP-01 | Uma pousada e um estoque inicial de bebidas. | Sem seletor de negócio ou infraestrutura de armazéns múltiplos. O marcador legado de restaurante serve à compatibilidade, não define o novo domínio. |
| DP-02 | Pessoa possui identidade estável e papéis. | Hóspede, cliente pagador e fornecedor não exigem cadastros duplicados. Documento é atributo pesquisável; alterações preservam histórico. |
| DP-03 | Quarto é recurso físico; hospedagem é permanência. | Mudar de quarto não muda a identidade da conta; próxima entrada não herda consumos anteriores. |
| DP-04 | Reserva pode conter mais de uma acomodação. | Grupo tem referência comum; cada acomodação tem ocupação, datas e diárias; confirmação não aceita subconjunto silencioso. |
| DP-05 | Preço aplicado e unidade são preservados. | Reajuste de catálogo ou tarifa não modifica documento confirmado. Mudanças de ocupação ou extensão são revisões explícitas. |
| DP-06 | Prestação, obrigação e liquidação são fatos distintos. | Empresa pode dever depois do check-out; receber título não gera outra receita comercial nem baixa de bebida. |
| DP-07 | Cada entrega de bebida baixa estoque uma vez. | Venda avulsa ou consumo da hospedagem é a origem; pagamento posterior não repete a baixa. |
| DP-08 | Fato confirmado é corrigido por compensação. | Estorno, perda e devolução mantêm origem e motivo; não editar saldo nem apagar histórico em cascata. |
| DP-09 | Um servidor modular e um banco transacional. | Preservar comandos do servidor, autorização, versões e repetição segura; sem serviços distribuídos para esta equipe. |
| DP-10 | Perfis iniciais com exceções individuais. | Novas ações de preço, crédito, compra e inventário exigem autorização própria; aprovação é por exceção relevante. |
| DP-11 | Uma ação do operador pode gerar vários vínculos. | Confirmar recebimento pode registrar compra, entrada e título atomicamente; não exigir três telas para um fato. |
| DP-12 | Dinheiro, preço, custo e quantidade têm regras explícitas. | Decimal, arredondamento por linha, conversão de embalagem preservada e saldo derivado de movimentos. |

## 4. Revisão de cada superfície atual

Manter significa conservar a finalidade. Revisar não significa refazer uma função existente. Estas constatações são leitura do código, não homologação visual de todos os formulários.

| Superfície atual | Situação e decisão |
| --- | --- |
| Login, demonstração e navegação desktop/mobile | Manter identificação de ambiente e acesso conforme permissão; restaurante já saiu da navegação. |
| Mapa e filtros | Manter condições dos quartos; diferenciar condição física atual de disponibilidade futura por período. |
| Cadastro de quartos | Revisar: categoria, capacidade e ocupação; tarifa estruturada ainda não aparece no modelo atual. |
| Bloqueio e liberação | Manter motivo, prazo e responsável; tratar conflito com reserva existente explicitamente. |
| Reservas e grupos | Revisar pagador, acomodação, ocupantes, preço por noite e referência comum; preservar proteção contra sobreposição. |
| Check-in sem/com reserva | Reaproveitar busca de pessoa e reserva; criar hospedagem e ocupantes com identidade própria. |
| Consumo do quarto | Revisar: hoje há consumo único por quarto e itens por descrição. Vincular à hospedagem e ao produto, conservando linhas históricas e baixa do estoque. |
| Recebimento de hospedagem | Reaproveitar parcial, saldo e crédito; integrar extrato, título e alocação sem duplicar lançamento. |
| Check-out | Hoje o servidor exige hospedagem e consumo quitados. Acrescentar exceção empresarial identificada; não tratar a regra nova como já implementada. |
| Troca de quarto | Acrescentar fluxo completo: validar destino, conservar conta e registrar histórico; evitar editar roomId livremente. |
| Cancelamento e no-show | Preservar multa, devolução/crédito e permissões; manter origem e tratamento do sinal. |
| Frente de Caixa e histórico | Manter bebida, carrinho, código de barras e desconto; explicitar entrega, cobrança e recebimento; ligar lançamento na hospedagem à mesma origem. |
| Catálogo, categorias e preços | Reaproveitar preço padrão e barcode; estoque só de bebidas. Serviço sem estoque permanece separado; não reintroduzir cozinha. |
| Entrada e movimentação de estoque | Hoje custo/validade são metadados de movimento. Acrescentar compra, lote/saldo e vínculo financeiro, sem segunda digitação da despesa. |
| Mínimos e alertas | Manter reposição; considerar saldo utilizável e acrescentar validade com ligação ao lote. |
| Clientes e cadastro rápido | Reaproveitar e integrar hóspedes/pagadores; consulta de CNPJ opcional e identidade estável. |
| Histórico de hóspedes | CPF ainda é chave de GuestProfile; planejar migração sem perder crédito ou relacionamentos. |
| Fornecedores | Reaproveitar; acrescentar recebimentos, preço de compra, saldo a pagar e histórico. |
| Despesas, vencimentos e parcelas | Manter para serviços/gastos; compra de bebida gera título vinculado em vez de despesa duplicada. |
| Contas a receber e cobrança | Reaproveitar títulos/parcelas; identificar estadias de origem e pagamentos posteriores à saída. |
| Contas e transferências | Manter saldo interno e operação atômica; identificar conferência e não vender saldo interno como conciliado. |
| Turno de caixa | Preservar responsável e fechamento. Existe um caixa aberto compartilhado por vez; suficiente como ponto de partida para a pousada, sem presumir múltiplos caixas. |
| Orçamento e centros de custo | Cadastros existentes não comprovam integração de apuração; não priorizar expansão antes dos ciclos essenciais. |
| Recorrências | Cadastro existe; gerador é evolução adiada, com reenvio seguro quando desenvolvido. |
| Relatórios | Revisar: gráficos centrados no POS não representam todo o faturamento da pousada. Separar hospedagem, bebida, recebimento e dinheiro. |
| Preferências e dados do negócio | Manter preferências pessoais separadas de política comercial. |
| Usuários e aprovações | Reaproveitar autorização no servidor; adaptar ações novas e manter administrador capaz de recuperar acesso. |
| Notificações e auditoria | Preservar eventos, destinatários, regras, origem e leitura individual; alertas do restaurante ocultos. |
| Exportação e restauração | Manter restritas; relatório gerencial e backup completo têm finalidades diferentes. |
| Revisão de conflito e painel externo | Reaproveitar comparação de registros e operação dos servidores; não misturar diagnóstico técnico com rotina do atendente. |

## 5. Telas, funções e acesso

Manter Mapa, Reservas, Frente de Caixa, Estoque, Financeiro, Relatórios, Configurações, Administração e Auditoria. Cadastros podem ficar acessíveis nos fluxos existentes; não criar um menu para cada entidade. As fichas T01–T09 abaixo agrupam tarefas, não impõem nove novas abas.

| Ação | Usuário habilitado | Limite/exceção |
| --- | --- | --- |
| Buscar/cadastrar pessoa | Recepção, caixa ou administrativo conforme permissão. | Sem acesso automático a crédito, dívida ou resultado. |
| Reservar e entrar hóspedes | Recepção. | Ocupação, estado e disponibilidade verificados; alteração de tarifa além da política exige poder próprio. |
| Lançar bebida/vender | Recepção/caixa. | Estoque utilizável e preço vigente; desconto acumulado acima do teto exige aprovação. |
| Autorizar prazo empresarial | Gestor ou operador com poder específico. | Pagador, origem e vencimento obrigatórios; não liberar check-out genérico com dívida. |
| Receber título | Recepção/administrativo habilitado. | Não alterar origem nem exceder saldo; estorno tem permissão própria. |
| Receber compra e contar estoque | Estoque/administrativo. | Receber não concede poder de pagar; ajuste aprovado requer motivo e autorização. |
| Pagar, transferir e conferir banco | Administrativo/gestor habilitado. | Consulta de conta, uso em recebimento e movimentação são poderes distintos. |
| Fechar turno | Responsável ou supervisor habilitado. | Contagem e divergência preservadas; fechamento de outro responsável é exceção específica. |
| Usuários e restauração | Administrador. | Sem obtenção desses poderes por aprovação genérica; histórico e ao menos um administrador ativo preservados. |
| Relatório/exportação | Domínio autorizado. | Mesmas permissões da consulta, inclusive chamadas diretas por ID. |

## 6. Modelo conceitual e cardinalidades

Entidades abaixo são responsabilidades de negócio; não obrigam uma tabela por nome nem substituem o projeto de migração. Reutilizar Customer, Supplier, Reservation, POSProduct, AccountReceivable e demais estruturas quando o contrato preservar os invariantes.

### 6.1 Pessoas e preços

| Entidade | Dados e relacionamento |
| --- | --- |
| Pessoa | ID estável, PF/PJ, nome, documento, contatos, situação; campos mínimos por rotina. Documento normalizado evita duplicação, mas não é chave técnica do histórico novo. |
| Empresa atual da pessoa | Cada PF pode ter zero ou uma empresa vinculada; cada PJ pagadora pode ter várias pessoas. `Customer.companyId` referencia outra identidade `Customer.id`. CPF válido na pessoa e CNPJ válido/papel pagador na empresa; vínculo editado no cadastro da pessoa. Sem histórico de emprego, cargos ou datas nesta entrega. |
| PapelPessoa | Uma pessoa pode ser hóspede, pagador e fornecedor. Views/telas conhecidas podem manter esses nomes. |
| Produto | Bebida, unidade-base, categoria, barcode opcional, compra/venda, estoque/lote e situação. Serviço não participa do saldo de bebidas. |
| PrecoProduto | Valor padrão e vigência; mudanças são auditadas. Não sobrescrever preço das linhas confirmadas. |
| CategoriaQuarto / Quarto | Categoria, número único, capacidade, condição física e situação; quarto pode ter tarifa específica. |
| TarifaHospedagem | Categoria ou quarto, quantidade/faixa de hóspedes, preço por pessoa/noite e vigência. Sem duas regras de igual prioridade para a mesma noite e ocupação. |

~~~mermaid
erDiagram
  PESSOA ||--o{ PAPEL_PESSOA : assume
  PESSOA o|--o{ PESSOA : empresa_atual
  PRODUTO ||--o{ PRECO_PRODUTO : precifica
  CATEGORIA_QUARTO ||--o{ QUARTO : classifica
  CATEGORIA_QUARTO ||--o{ TARIFA_HOSPEDAGEM : precifica
  QUARTO o|--o{ TARIFA_HOSPEDAGEM : especifica
~~~

Empresa vinculada é uma sugestão para novas reservas e entradas, substituível pelo operador. Escolher outro pagador explicitamente prevalece sobre a sugestão. Reserva confirmada conserva seu próprio pagador, preço, crédito e dívida; trocar ou remover a empresa no cadastro não altera operações anteriores. Inativação preserva vínculos existentes e impede novos vínculos/sugestões; empresa com pessoas vinculadas conserva CNPJ e papel pagador. Não inferir empregador de registros antigos.

### 6.2 Reserva, hospedagem e consumo

| Entidade | Dados e relacionamento |
| --- | --- |
| Reserva | Código, pagador, contato, situação e condições acordadas; uma ou mais acomodações. |
| AcomodacaoReservada | Reserva, categoria/quarto, período e ocupação; quarto obrigatório na confirmação inicial, sem bloqueio indefinido de quarto não atribuído. |
| DiariaAcordada | Acomodação, noite, quantidade cobrada, preço por pessoa, regra/versão, desconto e total. Mudança futura da tarifa não recalcula passado. |
| Hospedagem | Identidade estável da permanência, acomodação e entrada/saída efetivas. Uma acomodação origina no máximo uma hospedagem; check-in sem reserva cria origem consistente. |
| OcupanteHospedagem | Hospedagem e pessoa; titular/acompanhante. Mais de um ocupante; empresa pagadora não precisa ser hóspede. |
| AlocacaoQuarto | Hospedagem, quarto e intervalo; troca preserva histórico. Um quarto por hospedagem simples por vez; conflito validado contra reservas e bloqueios. |
| CobrancaHospedagem | Linha de diária, bebida ou ajuste com data, quantidade, preço, produto opcional e origem. Pagamento não apaga a linha; correção gera compensação. |
| MovimentoCredito | Pagador, geração/utilização/estorno e origem. Saldo derivado; vincular crédito legado de CPF à pessoa correta sem transferir silenciosamente para empresa. |

~~~mermaid
erDiagram
  PESSOA ||--o{ RESERVA : paga
  RESERVA ||--|{ ACOMODACAO_RESERVADA : contem
  ACOMODACAO_RESERVADA ||--|{ DIARIA_ACORDADA : precifica
  ACOMODACAO_RESERVADA ||--o| HOSPEDAGEM : origina
  HOSPEDAGEM ||--|{ OCUPANTE_HOSPEDAGEM : hospeda
  PESSOA ||--o{ OCUPANTE_HOSPEDAGEM : ocupa
  HOSPEDAGEM ||--|{ ALOCACAO_QUARTO : ocupa
  QUARTO ||--o{ ALOCACAO_QUARTO : recebe
  HOSPEDAGEM ||--o{ COBRANCA_HOSPEDAGEM : gera
  PRODUTO o|--o{ COBRANCA_HOSPEDAGEM : bebida
  PESSOA ||--o{ MOVIMENTO_CREDITO : possui
~~~

**Exemplo confirmado de estrutura, com valores fictícios:** um hóspede a R$ 120/pessoa/noite; dois hóspedes a R$ 100/pessoa/noite. Uma noite com dois custa R$ 200. Não cobrar R$ 100 pelo quarto nem reaplicar R$ 120 a cada pessoa. Prioridade: tarifa específica de quarto > tarifa de categoria; faixa de ocupação e vigência devem ser aplicáveis à noite. Mudança de hóspedes, extensão ou troca de quarto gera prévia das noites afetadas, com confirmação e eventual aprovação.

Adiantamento pode existir antes da entrada, vinculado à reserva/pagador. No faturamento empresarial, a saída e a dívida têm estados independentes. Crédito de hóspede não se torna automaticamente crédito da empresa que paga sua hospedagem.

### 6.3 Compras e estoque de bebidas

| Entidade | Dados e relacionamento |
| --- | --- |
| Compra / ItemCompra | Fornecedor, itens, quantidade de embalagem, conversão, custo, frete/desconto, documento e condição financeira. |
| RecebimentoCompra | Compra, itens aceitos/recusados, quantidade e responsável. Um recebimento não equivale a pagamento. Parcialidade é condicional; rotina inicial pode confirmar documento e recebimento em uma ação. |
| Lote | Produto, código interno/fornecedor, origem e validade real quando exigida; fornecedor ausente não autoriza inventar vencimento. |
| SaldoLote | Lote, quantidade e bloqueio; soma reconciliável com saldo do produto. Um local operacional inicial da pousada. |
| MovimentoEstoque | Produto/lote, quantidade na unidade-base, custo, tipo, instante, origem e responsável. Nunca originado apenas por pagar uma dívida. |
| Inventario / ItemInventario | Corte, saldo esperado, contado, diferença, aprovação e ajuste gerado; conservar movimentos posteriores ao corte. |
| Venda / ItemVenda | Data, produto, quantidade, preço, descontos, entrega e origem; venda e consumo da hospedagem não são duas origens para a mesma entrega. |

~~~mermaid
erDiagram
  PESSOA ||--o{ COMPRA : fornece
  COMPRA ||--|{ ITEM_COMPRA : contem
  COMPRA ||--o{ RECEBIMENTO_COMPRA : recebe
  RECEBIMENTO_COMPRA ||--o{ LOTE : origina
  PRODUTO ||--o{ LOTE : identifica
  LOTE ||--o{ SALDO_LOTE : possui
  PRODUTO ||--o{ MOVIMENTO_ESTOQUE : movimenta
  LOTE o|--o{ MOVIMENTO_ESTOQUE : rastreia
  INVENTARIO ||--|{ ITEM_INVENTARIO : compara
  ITEM_INVENTARIO ||--o| MOVIMENTO_ESTOQUE : ajusta
  VENDA ||--|{ ITEM_VENDA : contem
  PRODUTO ||--o{ ITEM_VENDA : vendido
~~~

Lote vencido continua no saldo físico, mas sai do utilizável. Venda/consumo escolhe primeiro o lote válido que vence antes. FEFO é ordem física de retirada; custo médio é método de valorização, não a mesma regra. Confirmar somente quantidade utilizável, inclusive sob concorrência.

### 6.4 Financeiro

| Entidade | Dados e relacionamento |
| --- | --- |
| ObrigacaoFinanceira | Receber/pagar, pagador/fornecedor, origem tipada, valor e condição. Origem única impede novo título para a mesma cobrança. |
| ParcelaObrigacao | Vencimento, valor ajustado e saldo derivado; atraso é condição de data sobre saldo em aberto. |
| Liquidacao / MeioLiquidacao | Pagamento/recebimento/crédito, data, valor, responsável, meio e destino. Vários meios podem ser reunidos sem somar duas liquidações completas. |
| AlocacaoLiquidacao | Liquidação, parcela e valor aplicado; relação muitos-para-muitos para pagamentos parciais e vários títulos num recebimento. |
| ContaFinanceira / MovimentoConta | Caixa ou banco, abertura/saldo inicial, entradas/saídas efetivas e origem. Transferência gera dois lados sem receita/despesa. |
| TurnoCaixa | Responsável, início/fim, fundo, contagem e divergência; um aberto por caixa físico. Modelo inicial reaproveita o caixa único existente. |
| ConferenciaConta | Movimentos observados e internos, diferença e responsável; conferência manual simples no núcleo. |
| RecebivelCartao / RepasseCartao | Evolução FIN-05: bruto, taxa, líquido, data prevista e entrada efetiva no repasse; não criar integração bancária automática. |
| RegraRecorrencia | Evolução FIN-11: gera obrigação prevista por período, não pagamento; regra existente precisa de gerador para ter efeito. |

~~~mermaid
erDiagram
  PESSOA ||--o{ OBRIGACAO : parte
  COBRANCA_HOSPEDAGEM o|--o{ OBRIGACAO : origem
  COMPRA o|--o{ OBRIGACAO : origem
  OBRIGACAO ||--|{ PARCELA : divide
  PARCELA ||--o{ ALOCACAO : quitada
  LIQUIDACAO ||--o{ ALOCACAO : aplica
  LIQUIDACAO ||--|{ MEIO_LIQUIDACAO : compoe
  CONTA_FINANCEIRA ||--o{ MOVIMENTO_CONTA : movimenta
  MEIO_LIQUIDACAO o|--o{ MOVIMENTO_CONTA : gera_quando_efetivo
  CONTA_FINANCEIRA ||--o{ TURNO_CAIXA : identifica
  TURNO_CAIXA o|--o{ MOVIMENTO_CONTA : dinheiro
~~~

Nos diagramas, vínculos de origem são ilustrativos: a regra de unicidade de cobrança é definida pelo documento e pelas linhas de origem, não pelo desenho agregado. Uma obrigação pode consolidar várias cobranças elegíveis; o detalhamento deve impedir que a mesma cobrança esteja em dois títulos ativos e conservar a alocação. Venda/compra à vista pode dispensar título persistido separado se a origem e a liquidação continuarem rastreáveis e atômicas. Crédito utilizado não gera MovimentoConta; adiantamento não alocado permanece vinculado ao pagador e à origem.

## 7. Eventos e invariantes

| Fato | Efeito físico | Efeito comercial/financeiro |
| --- | --- | --- |
| Reserva confirmada | Bloqueia período disponível. | Conserva diárias acordadas; reserva futura não é receita recebida. |
| Check-in | Abre hospedagem e alocação. | Adiantamentos e preços permanecem; não receber sinal novamente. |
| Bebida entregue no PDV | Baixa estoque uma vez. | Venda e recebimento ou vínculo à hospedagem, com uma origem. |
| Bebida lançada na hospedagem | Baixa estoque uma vez. | Linha vinculada à permanência; recebimento futuro somente quita. |
| Check-out a prazo empresarial | Encerra permanência; quarto vai para limpeza. | Formaliza dívida restante ou conserva título já criado; sem novo recebimento, baixa de bebida ou cobrança duplicada. |
| Compra recebida | Quantidade aceita entra nos lotes. | Gera obrigação vinculada conforme condição; à vista registra liquidação, sem despesa duplicada. |
| Estorno financeiro | Nenhuma reposição automática. | Reverte apenas valor elegível e alocação; retorno físico exige confirmação independente. |
| Inventário aprovado | Gera diferença no corte. | Não sobrescreve movimentos posteriores; ajuste tem custo, origem e motivo. |

Dados confirmados mantêm descrição, nome, unidade, conversão, preço/custo e referências usados. Inativar cadastro com histórico; impedir exclusão em cascata de documento comercial/financeiro. Saldo, pago e total consumido são derivados, não marcadores livres. APIs genéricas de cadastro não substituem comandos de negócio para confirmar, quitar ou estornar.

## 8. Requisitos funcionais detalhados

**N:** núcleo necessário à rotina/integridade. **C:** condicional, conforme uso no protótipo. **E:** evolução deliberadamente adiada. Classificação proposta não inventa confirmação do cliente nem autoriza desenvolvimento por si só. IDs originais são conservados para rastreabilidade; os intervalos ausentes estão explicados na auditoria de escopo.

### 8.1 Pessoas e catálogo

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| CAD-01 | N | Cadastrar PF/PJ, cliente/fornecedor/hóspede, contatos, situação e endereço quando necessário. PF pode ter empresa atual opcional; ficha da empresa lista pessoas vinculadas. Sugestão de pagador para novas hospedagens é alterável e não reescreve histórico. |
| CAD-02 | N | Buscar por nome, telefone e documento; impedir duplicação do mesmo documento normalizado, com tratamento de cadastros legados. |
| CAD-03 | N | Venda avulsa de bebida pode ser anônima; venda a prazo exige pagador identificado e autorização. Identificar hóspedes segundo a política de hospedagem, sem exigir CPF de empresa para cada ocupante. |
| CAD-04 | N | Consultar CNPJ sob demanda e confirmar dados antes de salvar; falha da API permite cadastro manual. |
| CAD-05 | N | CNPJ é textual e comporta formato numérico e alfanumérico; CPF segue sua própria validação. |
| CAD-06 | N | Cadastro rápido reutiliza a mesma identidade do cadastro completo; inativação mantém histórico. |
| CAD-07 | N | Ficha da pessoa mostra hospedagens, cobranças, recebimentos e crédito conforme as permissões atuais; cadastrar pessoa não libera automaticamente consulta financeira. |
| CAD-08 | N | Item distingue bebida física de serviço sem estoque; registra unidade-base, categoria, controle de estoque/lote, compra/venda e situação. Estoque operacional da pousada aceita somente bebidas. |

### 8.2 Preços

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| PRE-01 | N | Cadastrar preço padrão das bebidas e preço por pessoa/noite para categoria de quarto e ocupação; permitir regra específica de quarto sem faixas ambíguas. |
| PRE-02 | N | Tarifa específica de quarto vigente prevalece sobre a categoria; condição acordada com empresa pode ser registrada na reserva por ação autorizada. Preservar preço e motivo da exceção, sem criar contrato de refeições. |
| PRE-03 | N | Preço e regra aplicados ficam preservados na linha de operação, mesmo após reajuste de cadastro. |
| PRE-04 | N | Descontos consideram efeito acumulado; ultrapassar limite exige aprovação específica e auditada. |
| PRE-05 | N | Configurar preço por pessoa/noite por quarto/categoria e quantidade/faixa de hóspedes; calcular total com ocupação confirmada e preservar regra por noite. Tarifas sazonais são evolução configurável. |
| PRE-06 | N | Mudança de preço do fornecedor não altera automaticamente preço de venda. Mostrar custo e sugerir revisão sem aplicar silenciosamente. |

### 8.3 Hospedagem

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| HOS-01 | N | Mapa mostra condição física; consulta por período mostra disponibilidade e conflitos. |
| HOS-02 | N | Reserva informa pagador, contato, período, quartos/categorias e valor sugerido por diária. |
| HOS-03 | N | Confirmar reserva individual/grupo sem sobreposição; grupo é confirmado integralmente ou recusado. |
| HOS-04 | N | Check-in registra ocupantes e abre hospedagem ligada à reserva; atendimento sem reserva gera origem consistente. |
| HOS-05 | N | Lançar bebidas de catálogo com preço da pousada e baixa do estoque da pousada no consumo confirmado. |
| HOS-06 | N | Extrato da hospedagem mostra diárias, bebidas, ajustes, adiantamentos, recebimentos e saldo. |
| HOS-07 | N | Troca de quarto conserva hospedagem, conta e histórico; verifica capacidade e disponibilidade de destino. |
| HOS-08 | N | Recebimentos parciais são permitidos; check-out exige quitação ou condição empresarial a prazo identificada e autorizada. Em ambos, quarto passa para limpeza; dívida a prazo permanece aberta. |
| HOS-09 | N | Cancelamento e no-show preservam motivo; reserva paga admite multa/reembolso/crédito com autorização prevista. |
| HOS-10 | N | Crédito é movimentado por operações autorizadas e pertence ao pagador definido; sem edição direta de saldo. |
| HOS-11 | N | Cobrança empresarial posterior ao check-out mantém conta a receber aberta, empresa pagadora, vencimento, saldo e acompanhamento de cobrança vinculados à hospedagem encerrada. |

### 8.4 Frente de Caixa

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| PDV-01 | N | Buscar bebida por nome/barcode, sugerir preço padrão e mostrar saldo utilizável antes de confirmar; serviço sem estoque não altera o saldo. |
| PDV-02 | N | Carrinho preserva quantidade, preço aplicado e desconto por linha; recalcular total no servidor e verificar desconto efetivo acumulado. |
| PDV-03 | N | Confirmar venda/entrega/estoque/recebimento atomicamente; opção de lançar na hospedagem ativa conserva a mesma origem, sem cobrar duas vezes. |
| PDV-04 | N | Identificar pessoa quando houver prazo ou vínculo empresarial; venda avulsa anônima é permitida. Venda a prazo fora da hospedagem é condicional a autorização e uso real. |
| PDV-05 | N | Permitir recebimento misto; troco pertence somente à parcela em dinheiro. Não atribuir troco ao PIX/cartão nem liquidar valor acima do saldo. |
| PDV-06 | N | Histórico relaciona venda, cobrança, pagamentos e estornos; cancelamento financeiro e devolução física são decisões distintas. |
| PDV-07 | C | Estorno parcial exige itens/valores e origem; limite acumulado não excede o que foi recebido e devolução não repõe bebida consumida. Evoluir o fluxo atual apenas quando demonstrado no protótipo. |

### 8.5 Compras

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| COM-01 | N | Receber compra de bebidas em uma tela com fornecedor, itens, conversão de embalagem, custo, lote/validade, divergências e condição financeira. O destino inicial é o estoque único da pousada. |
| COM-02 | N | Confirmação cria recebimento, entradas e obrigação vinculada sem duplicação; pagamento à vista é etapa de liquidação. |
| COM-03 | N | Compra por caixa/fardo converte explicitamente para a unidade-base da bebida; preservar fator e custo unitário aplicados. Alterar embalagem do cadastro não reescreve recebimentos passados. |
| COM-04 | N | Compra aceita desconto/frete com regra de distribuição e conserva o total financeiro em centavos. |
| COM-05 | C | Pedido prévio e recebimento parcial são oferecidos se a rotina usar encomendas; saldo a receber fica separado de dívida. |
| COM-06 | N | Conferência informa divergências e produtos recusados; quantidade recusada não entra no saldo utilizável. |
| COM-07 | N | Devolução identifica lote recebido e acerto com fornecedor; não apaga compra nem presume reembolso imediato. |
| COM-08 | N | Serviço e gasto sem estoque podem ser lançados como despesa; compra de mercadoria não exige segunda digitação de despesa. |
| COM-09 | N | Histórico de fornecedor mostra itens, preços, recebimentos, dívida e pagamentos. |

### 8.6 Estoque de bebidas

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| EST-01 | N | Saldo de bebidas por produto e lote quando rastreado; saldo utilizável exclui vencidos/bloqueados. Começar com um local da pousada, sem gestão de armazéns múltiplos. |
| EST-02 | N | Bebida sujeita a validade exige lote do fornecedor ou lote interno e data real de vencimento conforme política do produto. Não inventar validade; preservar a origem da entrada. |
| EST-03 | N | Saída sugere lote válido de vencimento mais próximo; vencido não pode ser vendido/usado. |
| EST-04 | N | Baixa física ocorre uma vez na confirmação de consumo/entrega, não novamente no recebimento do dinheiro. |
| EST-05 | N | Pousada aceita somente bebidas no seu estoque operacional; ingrediente do restaurante não aparece como saldo da pousada. |
| EST-06 | N | Ajustes, perdas e consumo interno têm quantidade, motivo e responsável; saldo não é sobrescrito livremente. |
| EST-07 | N | Inventário compara contagem e saldo no corte; aprovação gera diferença rastreável sem perder movimentos posteriores. |
| EST-09 | N | Alertas de mínimo e validade mostram produto/lote e abrem a tarefa correspondente. |
| EST-10 | N | Saldo insuficiente bloqueia operação concorrente; divergência física se resolve por ajuste autorizado, não estoque negativo silencioso. |

### 8.7 Financeiro

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| FIN-01 | N | Contas a pagar/receber têm pessoa, origem tipada, valor, parcelas, vencimento e situação derivada. Hospedagem empresarial e compra identificam os documentos que geraram a obrigação. |
| FIN-02 | N | Pagamentos parciais alocam valor às parcelas; recebido/pago e saldo são derivados do histórico. |
| FIN-03 | N | Adiantamentos e crédito interno conservam origem e saldo; utilização não gera segunda receita de caixa. |
| FIN-04 | N | Dinheiro exige turno aberto no caixa físico; PIX registra entrada na conta definida e comprovante opcional. |
| FIN-05 | E | Agenda de cartão: valor bruto, taxa, líquido e data prevista; repasse confirmado gera entrada bancária. Evolução proposta, preservada no backlog. Até sua implementação, identificar explicitamente o registro simplificado atual e não apresentar saldo interno como banco conciliado. |
| FIN-06 | N | Abertura, sangria, suprimento e fechamento de caixa identificam responsável, valor e origem/destino. |
| FIN-07 | N | Fechamento compara contagem física com movimentos do turno; divergência é registrada, não escondida por ajuste de fundo. |
| FIN-08 | N | Transferência entre contas conserva total financeiro e não é classificada como venda/despesa. |
| FIN-09 | N | Extrato interno distingue previsto e efetivo; conferência manual associa o movimento ao registro observado e identifica diferenças. Não exigir integração bancária para operar. |
| FIN-10 | E | Importar extrato CSV com prévia e proteção contra duplicação; integração bancária automática fica fora desta versão. |
| FIN-11 | E | Gerador de recorrência cria obrigação prevista uma vez por período e nunca paga automaticamente. Evolução proposta; cadastro de regra existente não significa geração implementada. |
| FIN-12 | N | Fluxo projetado simples considera saldo inicial e títulos abertos a pagar/receber por vencimento. Previsão de reserva e, futuramente, repasse de cartão aparecem separados de dinheiro disponível. |
| FIN-13 | N | Estornos preservam origem, limite do valor já recebido/pago e autorização; crédito e devolução física não são confundidos. |

### 8.8 Relatórios

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| REL-01 | N | Relatórios distinguem vendido/prestado, cobrado, recebido, custo e saldo disponível. |
| REL-03 | N | Pousada mostra ocupação, diárias acordadas/prestadas, bebidas e saldos pendentes. |
| REL-04 | N | Estoque mostra saldo utilizável de bebidas, valor pelo método declarado, mínimos, validade por lote, perdas e movimentos. |
| REL-05 | N | Resultado gerencial da pousada separa hospedagem, bebidas, custos consumidos e despesas. Compra de mercadoria não equivale automaticamente a custo consumido; transferências entre contas não geram resultado. |
| REL-06 | N | Exportações e demonstrativos conservam filtros, período, totais e origem, verificam permissão e indicam que são documentos gerenciais não fiscais. |
| REL-07 | N | Cada total oferece detalhamento até sua origem; resultado estimado identifica dados e custos ausentes, sem depender de ficha técnica de cozinha. |

### 8.9 Relação com o resumo PO-01–PO-20

Os IDs PO da versão 0.4 continuam como índice de temas, não substituem os requisitos detalhados. A coluna critério corresponde ao resumo anterior; sua execução deve respeitar os detalhes e cenários atuais.

| ID | Tema | Critério resumido anterior |
| --- | --- | --- |
| PO-01 | Cadastro único de pessoa e empresa, com cliente/pagador, contato e documento. | A mesma empresa pode pagar estadias de hóspedes diferentes sem duplicar o cadastro. |
| PO-02 | Busca cadastral por CNPJ opcional e conferida pelo operador. | Falha na consulta permite cadastro manual; documento fica como texto e suporta evolução do formato. |
| PO-03 | Cadastro de fornecedores de bebidas e despesas. | Uma entrada ou conta a pagar pode identificar o fornecedor. |
| PO-04 | Produtos com categoria, unidade, preço padrão, código de barras opcional e controle de estoque. | Carrinho usa o preço padrão e preserva o preço de cada venda. |
| PO-05 | Tabela de diária por quarto/tipo e quantidade de hóspedes. | Reservas de um, dois e três hóspedes podem ter valores diferentes configurados; a tela explica o cálculo. |
| PO-06 | Identificar hóspedes e pagador da hospedagem separadamente. | Uma reserva empresarial identifica quem ficou e quem será cobrado. |
| PO-07 | Reservas com período válido, bloqueio de sobreposição e mudança de quarto controlada. | Dois operadores não confirmam reservas incompatíveis para o mesmo quarto. |
| PO-08 | Check-in, limpeza, bloqueios e check-out coerentes. | Saída atualiza ocupação sem apagar despesas ou consumo pendentes. |
| PO-09 | Permitir saída com pagamento empresarial posterior autorizado. | A saída cria ou vincula dívida ao pagador; o saldo não desaparece nem é marcado como pago. |
| PO-10 | Títulos a receber com vencimento, saldo, pagamento parcial e histórico. | Recebimento reduz o saldo e gera lançamento financeiro uma única vez. |
| PO-11 | Cobrança simples por empresa ou cliente. | Consultar saldo aberto, vencido e estadias relacionadas, com relatório ou extrato. |
| PO-12 | Venda de bebidas no caixa ou consumo vinculado à hospedagem. | Baixa de estoque e cobrança não se duplicam quando um consumo é quitado. |
| PO-13 | Recebimento de compra de bebidas com custo, quantidade, fornecedor e validade quando aplicável. | Entrada gera saldo e, quando a prazo, conta a pagar relacionada. |
| PO-14 | Lotes, validade, perdas e inventário simples. | Alertar vencimentos, impedir uso de lote vencido e registrar ajuste com motivo. |
| PO-15 | Abertura e fechamento de turno, meios de pagamento e contas. | Divergências ficam explícitas; estorno autorizado preserva a rastreabilidade. |
| PO-16 | Despesas, pagamentos e transferências identificados. | Transferência entre contas não vira receita ou despesa operacional. |
| PO-17 | Indicadores úteis ao proprietário. | Ocupação, saldo a receber, receitas, despesas e reposição usam dados reais do período. |
| PO-18 | Permissões individuais e aprovações. | Recepção e caixa operam apenas o necessário; supervisão controla descontos, cancelamentos e estornos. |
| PO-19 | Concorrência e integridade. | Edição desatualizada é recusada com orientação; ações repetidas não duplicam lançamentos. |
| PO-20 | Recuperação e backup verificável. | Cópia configurável em pasta local e restauração testada em ambiente separado. |

## 9. Especificação das fichas de tarefa

| Ficha | Usuário e entrada mínima | Informação/ação principal | Correção e saída |
| --- | --- | --- | --- |
| T01 — Pessoas e fornecedores | Operador habilitado; nome, tipo, contato/documento conforme rotina. | Buscar antes de cadastrar; dados CNPJ conferidos; mostrar pessoa e pagador escolhidos. | Inativação preserva histórico; erro de duplicidade oferece cadastro existente, sem mescla automática. |
| T02 — Quartos e tarifas | Gestor; quarto/categoria, capacidade, ocupação, vigência e preço por pessoa. | Prévia de uma/duas/três pessoas e noites; identificar regra específica e conflitos. | Editar afeta uso futuro; operações confirmadas não são recalculadas. |
| T03 — Reserva e hospedagem | Recepção; período, quarto, hóspedes/quantidade e pagador. | Disponibilidade, diárias por noite, sinal, consumo e saldo; entrada/troca/saída em contexto. | Exceção empresarial mostra dívida/vencimento antes da saída; ajustes e cancelamento têm motivo e autorização. |
| T04 — Frente de Caixa | Operador; produto, quantidade e forma de cobrança. | Busca rápida, carrinho, subtotal/desconto, pagamento ou hospedagem; saldo antes da confirmação. | Resposta perdida mantém identidade da operação; histórico oferece estorno com destino físico explícito. |
| T05 — Receber compra | Estoque/administrativo; fornecedor, embalagem/quantidade, custo, lote/validade e prazo. | Uma prévia: unidades aceitas, custo distribuído e conta a pagar; confirmar uma vez. | Rejeitados não entram; devolução vinculada e acerto financeiro independentes. |
| T06 — Estoque e inventário | Estoque; produto/lote, contagem/corte ou quantidade/motivo. | Saldo físico/utilizável, mínimos, vencimentos e diferença; aprovar ajuste quando habilitado. | Nenhuma edição livre de saldo; excluir rascunho não apaga movimento aprovado. |
| T07 — Cobranças e recebimentos | Administrativo/recepção; pagador, títulos, valor e meio. | Extrato da estadia/empresa, parcelas, vencido e alocação; separar aberto de recebido. | Pagamento parcial, estorno autorizado e crédito conservam origem e saldo. |
| T08 — Caixa e contas | Responsável/gestor; fundo, movimentos, contagem e destino de valores. | Abrir/fechar, conferência de extrato, divergência e saldo interno; transferir não é despesa. | Turno fechado não muda fundo; sangria/suprimento têm contrapartida e registro. |
| T09 — Gestão e operação | Gestor/admin; período/filtros ou ação autorizada. | Relatórios com origem, tarefas e notificações; acesso, auditoria e recuperação separados da operação diária. | Exportar conserva filtros/permissão; restauração ocorre com backup e em ambiente controlado. |

Campos avançados ficam progressivos; repetir cadastros e esconder estado não simplifica uma tarefa. Preservar teclado no desktop, foco e ações acessíveis no mobile. Não depender exclusivamente de cor para indicar risco/estado.

## 10. Fluxos de ponta a ponta

1. **Reserva:** buscar pagador → datas/quarto/ocupação → calcular e revisar cada noite → confirmar com disponibilidade vigente → registrar sinal separadamente → entrada vinculada.
2. **Bebida avulsa:** selecionar produto → quantidade/preço → verificar estoque → escolher meio → confirmar entrega e liquidação; corrigir por estorno/devolução, sem segunda venda.
3. **Bebida na hospedagem:** selecionar permanência ativa e produto → confirmar entrega/baixa → conservar cobrança no extrato → receber uma vez, antes ou depois da saída empresarial autorizada.
4. **Empresa depois da saída:** revisar diárias/bebidas/sinais → confirmar empresa e vencimento → encerrar estadia e registrar dívida restante → cobrar pelo extrato → receber parcial/total sem nova prestação.
5. **Compra:** buscar fornecedor → informar caixa/fardo e conversão → custo/lote/validade/prazo → prévia → confirmação atômica de documento/entrada/obrigação → pagamento relacionado.
6. **Inventário:** definir corte → contar → comparar → aprovar diferença → movimento de ajuste; saídas posteriores ao corte continuam contabilizadas.
7. **Troca de quarto:** consultar destino/período/capacidade → prévia de preço se aplicável → registrar nova alocação sem mudar hospedagem → quarto anterior vai para limpeza.
8. **Cancelamento pago:** conferir recebido/crédito → motivo e supervisor → multa/destino → estorno ou crédito de origem → ajustar cobrança e liberar período sem alterar ocupante atual de outra reserva.
9. **Fechamento:** conferir movimentos do turno → contagem física → diferença → fechar; banco e PIX não entram como notas/moedas contadas.

## 11. Estados e transições

| Documento | Estados conceituais | Efeito e limite |
| --- | --- | --- |
| Reserva | Rascunho, confirmada, entrada realizada, concluída, cancelada, no-show. | Confirmar protege período; rascunho não bloqueia indefinidamente; cancelamento preserva sinal e tratativa. |
| Hospedagem | Em andamento, encerrada. | Encerrar exige quitação ou prazo empresarial autorizado; a dívida pode continuar aberta. |
| Quarto | Disponível, ocupado, limpeza, bloqueado. | Condição física não substitui agenda futura; troca/saída geram limpeza e liberação própria. |
| Venda/cobrança | Confirmada, parcialmente liquidada, liquidada, estornada parcial/total. | Entrega não é sinônimo de liquidação; estado financeiro deriva das alocações. |
| Compra | Rascunho, confirmada, recebida, cancelada/ajustada. | Recebida não significa paga; recebimento parcial é extensão condicional e preserva origem. |
| Parcela | Aberta, parcial, quitada, cancelada/ajustada. | Vencida é atributo de prazo/saldo; novo recebimento não pode exceder o elegível. |
| Lote | Utilizável, bloqueado, vencido, esgotado. | Vencido não desaparece do físico e não retorna a utilizável por desbloqueio administrativo. |
| Inventário | Em contagem, em revisão, aprovado, cancelado antes do ajuste. | Depois da aprovação, correção por novo ajuste, sem apagar documento. |
| Turno | Aberto, em conferência, fechado. | Um aberto por caixa; contagem, fundo e divergência ficam preservados. |

Esses estados são do alvo funcional. Não renomear valores persistidos durante uma sprint sem migração e compatibilidade explícitas. Pendências operacionais e financeiras podem coexistir; não comprimir tudo num booleano pago.

## 12. Cálculos, conceitos e relatórios

- **Noite acordada:** quantidade cobrada × tarifa por pessoa aplicável àquela noite, menos ajuste autorizado. Total da hospedagem soma noites e ajustes; quantidade de pessoas não é quantidade de quartos.
- **Período:** entrada inclusiva e saída exclusiva; noites = diferença entre datas de calendário. Uma reserva pode começar na saída da anterior, mas entrada depende da liberação física.
- **Linha comercial:** quantidade na unidade-base/de cobrança × preço aplicado; arredondar por linha antes da soma. Desconto global é distribuído em centavos; teto considera o efeito acumulado.
- **Saldo de dívida:** valor ajustado − alocações válidas. Estorno de recebimento restaura saldo; crédito interno quita por alocação, sem entrada de dinheiro.
- **Receita prestada:** diária efetivamente prestada e bebida entregue; reserva futura/sinal não são prestação. Relatório de caixa considera recebimentos efetivos, explicitamente identificado.
- **Compra:** quantidade aceita na unidade-base × custo-base, com distribuição de frete/descontos que reconcilie centavos. Pagamento e custo consumido são conceitos distintos.
- **Saldo utilizável:** saldo físico menos quantidades bloqueadas/vencidas, sem contar o mesmo lote duas vezes. Mínimo compara quantidade utilizável.
- **Custo médio:** média ponderada por entradas valorizadas do produto; retirada por validade não redefine a média. Perda/devolução conservam valor e origem segundo método declarado.
- **Inventário:** diferença no corte = contado − esperado; aplicar diferença ao saldo corrente, preservando os movimentos posteriores.
- **Banco interno:** saldo inicial + entradas efetivas − saídas; transferência conserva o total entre contas. Só declarar conciliado quando conferido.
- **Dinheiro:** fundo + movimentos líquidos em dinheiro = esperado do turno; troco devolvido não vira receita. Comparar com contagem física, sem esconder diferença mudando fundo.
- **CMV/resultado:** explicitar método e cobertura; compra não é automaticamente consumo. Perdas já incluídas na variação de estoque não devem ser somadas novamente como segundo custo.

| Relatório mínimo | Regra de leitura |
| --- | --- |
| Operação do dia | Chegadas, saídas, limpeza, bloqueios, ocupação e saldos pendentes. |
| Ocupação | Noites-quarto ocupadas / noites-quarto disponíveis; critério de bloqueios e disponibilidade declarado. Quantidade de hóspedes não muda o denominador para pessoas. |
| Diária média | Receita de diárias prestadas / noites-quarto ocupadas, com escopo declarado; bebidas e sinais ficam fora. |
| Extrato de estadia/empresa | Diárias, bebidas, ajustes, sinais, recebimentos e saldo por origem; dívida após saída continua consultável. |
| Bebidas/estoque | Vendas/consumos, preço aplicado, saldo utilizável, lote/validade, custo, perdas e reposição. |
| Compras/fornecedor | Recebimentos, embalagem/conversão, custo, obrigação e pagamento. |
| Caixa/contas | Movimentos efetivos, fundo, contagem, divergência, transferências e conferência. |
| Previsto/realizado | Títulos em aberto por vencimento, saldo projetado simples e recebimentos/pagamentos realizados. |
| Resultado gerencial | Hospedagem e bebidas separados, custos conhecidos e despesas; dados ausentes e estimativas visíveis. Sem escrituração fiscal/contábil. |

Cada total deve abrir seu detalhamento até a origem. Não somar venda + título + recebimento como três receitas. Exportações conservam período, filtros, critérios, totais e autorização.

## 13. Qualidade, acesso e operação

| ID | Requisito | Verificação |
| --- | --- | --- |
| QUA-01 | Integridade: confirmar documento e efeitos relacionados integralmente, ou não aplicar nenhum efeito. | Falha simulada em compra, entrega e liquidação não deixa saldo/título parcial. |
| QUA-02 | Reenvio seguro: repetição da mesma confirmação não cria efeitos duplicados. | Repetir pedido após resposta perdida retorna o mesmo resultado. |
| QUA-03 | Concorrência: versão em cadastros e confirmação contra estado vigente; estoque, crédito e disponibilidade protegidos. | Dois usuários concorrentes recebem resultado coerente e explicação de conflito. |
| QUA-04 | Autorizar cada ação no servidor, incluindo consulta por ID, exportação e anexo. Ausência de botão não substitui autorização; administrar pessoas não permite consultar bancos ou estornar pagamentos. | Chamada direta a documento sem autorização é recusada. |
| QUA-05 | Auditar alterações de preço, hospedagem, compras, ajustes, cancelamentos, acessos e liquidações sem segredos; identificar documento, executor, aprovador, motivo e antes/depois permitido. | Origem, motivo, executor e aprovador identificáveis. |
| QUA-06 | Datas de negócio em calendário; eventos com instante e fuso operacional explícito. | Virada de dia/mês não desloca operação, limite ou relatório. |
| QUA-07 | Operação local continua sem internet se servidor e rede local estiverem disponíveis. | Cadastro/venda funcionam; busca de CNPJ falha com alternativa manual. |
| QUA-08 | Sem servidor/rede, sinalizar indisponibilidade e não afirmar que salvou. | Formulário preservado quando possível; retomada exige confirmação segura. |
| QUA-09 | Sincronizar atualizações sem sobrescrever formulário em edição. | Segundo usuário vê novo estado; edição antiga recebe comparação. |
| QUA-10 | Português simples, ambiente claramente identificado, estados e consequências explícitos; preservar o estilo visual sem exigir que o funcionário interprete termos de implementação. | Funcionário executa cenários sem interpretar siglas técnicas. |
| QUA-11 | Desktop por teclado; mobile com campos adequados, foco, ações de toque e sem rolagem horizontal essencial. | Cenários T03/T04/T05 em celular e computador. |
| QUA-12 | Alvos frequentes de toque de 44 px como objetivo de desenho; não depender apenas de cor. | Inspeção de dimensões, contraste, rótulos e foco. |
| QUA-13 | Meta inicial: cinco usuários simultâneos e confirmação usual em até 2 s na máquina final, com volume representativo. | Medir percentil 95; investigar operações lentas. Meta depende de dimensionamento, não promessa de desempenho atual. |
| QUA-14 | Backup completo, segunda pasta opcional, retenção e restauração verificável. | Recuperar usuários, documentos, saldos e auditoria em ambiente isolado. |
| QUA-15 | Frequência de backup e tempo de recuperação devem ser acordados; proposta inicial RPO 24 h e RTO 4 h. | Proprietário confirma tolerância; exercício real mede tempo. Sincronizar pasta não prova existência de cópia externa. |
| QUA-16 | Demonstração isolada de dados, credenciais, volumes, notificações e destinos de backup operacionais. | Alterar/resetar demo não altera produção. |
| QUA-17 | Dados pessoais mínimos por rotina, acesso restrito e histórico sem senhas/dados de cartão completos. | Revisar campos, logs e exportações. Prazos de retenção serão acordados. |
| QUA-18 | Consulta de CNPJ com prazo, controle de chamadas/cache e preenchimento manual; nenhuma varredura em massa. | Falha externa não impede operação; dados não são atualizados silenciosamente. |
| QUA-19 | Importação inicial com prévia, validação, relatório de rejeições e ausência de duplicação. | Carregar exemplo duas vezes não cria clientes ou saldos repetidos. |
| QUA-20 | Instalação e atualização previsíveis, sem arquitetura distribuída desnecessária. | Responsável consegue iniciar, diagnosticar, fazer backup e restaurar com guia. |

Resposta perdida não comprova recusa da gravação: informar resultado ainda não confirmado, consultar/reenviar a mesma identidade e não criar uma operação nova. Sem acesso ao servidor, não prometer operação offline completa nem gravação salva.

RPO 24 h e RTO 4 h são propostas a validar na homologação, não tolerâncias confirmadas. Cinco usuários simultâneos e confirmação usual em até 2 s no percentil 95 são metas a medir no equipamento final, não promessa atual. Pasta sincronizada com Drive não comprova backup externo nem restauração.

Permissões, concorrência, mobile e falhas fazem parte da aceitação de cada sprint. A última sprint integra homologação e recuperação; não deixa esses controles para serem construídos somente ao final.

## 14. Cenários de aceitação

Valores abaixo são exemplos, não tabela comercial aprovada. C/E não bloqueiam entrega inicial quando formalmente adiados; sua regra é preservada para futura evolução.

| Cenário | Resultado esperado | Referências |
| --- | --- | --- |
| AP-01 — Pessoa repetida | Mesmo documento normalizado busca cadastro existente; alteração do atributo preserva ID e relações. | CAD-02/06 |
| AP-02 — CNPJ e consulta | Preservar letras quando aplicável; consulta indisponível permite cadastro manual e conferido. | CAD-04/05, QUA-18 |
| AP-03 — Ocupação por pessoa | Um hóspede a 120/pessoa/noite custa 120; dois a 100/pessoa/noite custam 200. | PRE-05 |
| AP-04 — Duas noites e sinal | Dois hóspedes × 100 × duas noites + bebidas 24 − sinal 100 = saldo 324. | PRE-03/05, HOS-06, FIN-03 |
| AP-05 — Reajuste | Mudança de catálogo/tarifa não altera noite ou bebida já acordada; nova linha usa condição aplicável. | PRE-03 |
| AP-06 — Capacidade e tarifa | Regra por faixa não autoriza exceder capacidade; tarifa de quarto aplicável prevalece sem ambiguidade. | HOS-02, PRE-01/05 |
| AP-07 — Grupo concorrente | Conflito de uma acomodação recusa confirmação integral, com orientação ao operador. | HOS-03, QUA-03 |
| AP-08 — Troca | Mesmo ID da hospedagem, diárias/bebidas/pagamentos preservados; disponibilidade validada; quarto anterior para limpeza. | HOS-07 |
| AP-09 — Próximo hóspede | Nova entrada no mesmo quarto não herda consumo nem dívida da estadia anterior. | HOS-04/05/06 |
| AP-10 — Saída empresarial | Saldo 324 vinculado à empresa/vencimento; quarto para limpeza e hospedagem encerrada; posterior recebimento 100 deixa 224. | HOS-08/11, FIN-02 |
| AP-11 — Saída comum pendente | Sem autorização de prazo empresarial, saldo restante impede conclusão; aprovação não altera quem é pagador. | HOS-08, QUA-04 |
| AP-12 — Multa/crédito | Recebido 200, multa 50, crédito 150; supervisor/motivo e origens preservados, sem dinheiro fictício. | HOS-09/10, FIN-03/13 |
| AP-13 — Bebida da estadia | Duas bebidas baixadas no lançamento; recebimento não baixa duas outras nem apaga extrato comercial. | EST-04, HOS-05/06 |
| AP-14 — PDV na hospedagem | Mesma entrega pode ser cobrada em uma rota; sem duplicar consumo, venda e estoque. | PDV-03 |
| AP-15 — Troco/misto | Conta 100: PIX 40 + dinheiro 70 devolve 10 em dinheiro; entrada líquida 60 no caixa e 40 na conta. | PDV-05, FIN-04 |
| AP-16 — Desconto acumulado | Item/global e reduções sucessivas respeitam teto e aprovação vinculada; servidor recalcula. | PRE-04, PDV-02 |
| AP-17 — Compra convertida | Duas caixas de 12 aceitas = 24 unidades; custo 120 = 5/unidade antes de frete; uma entrada e uma obrigação. | COM-01/02/03 |
| AP-18 — Custo distribuído | Desconto/frete conservam total em centavos; reajuste do fornecedor não muda preço de venda sozinho. | COM-04, PRE-06 |
| AP-19 — Compra recusada/devolvida | Recusados não entram; devolução rastreia lote e acerto com fornecedor sem presumir reembolso. | COM-06/07 |
| AP-20 — Validade | Lote válido mais próximo é retirado primeiro; vencido não supre falta e continua físico até descarte autorizado. | EST-01/02/03 |
| AP-21 — Estoque concorrente | Última bebida só é vendida uma vez; segundo operador recebe saldo atualizado sem negativo. | EST-10, QUA-03 |
| AP-22 — Inventário com saída | Esperado 20, contado 18, saída posterior 3: ajuste −2 conserva saldo final 15. | EST-07 |
| AP-23 — Estorno físico | Reembolso de bebida consumida não repõe quantidade; bebida devolvida utilizável é registro físico explícito. | FIN-13, PDV-06 |
| AP-24 — Alocação parcial | Título 600, recebimento 250 deixa 350; dois títulos no mesmo recebimento conservam soma e origem. | FIN-01/02 |
| AP-25 — Transferência | Entre contas próprias não aumenta receita/despesa; os dois saldos se alteram integralmente ou nenhum. | FIN-08, QUA-01 |
| AP-26 — Turno | Fundo, contagem e diferença preservados; fechamento por usuário sem poder é recusado. | FIN-06/07, QUA-04 |
| AP-27 — Resposta perdida | Reenvio de compra/saída/recebimento retorna efeito existente, sem nova entrada, título ou baixa. | QUA-01/02/08 |
| AP-28 — Acesso direto | Ocultar botão não basta: consulta/exportação e ação sem permissão são negadas no servidor. | QUA-04 |
| AP-29 — Relatórios | Hospedagem 300 prestada + bebida 20; receber dívida antiga 50 não eleva prestação atual para 370. | REL-01/03/07 |
| AP-30 — Datas | Virada de dia/fuso não desloca noite, vencimento ou turno; período entrada inclusiva/saída exclusiva. | QUA-06 |
| AP-31 — Demonstração | Resetar exemplos não muda banco, usuários, backup ou notificações operacionais. | QUA-16 |
| AP-32 — Migração/recuperação | Crédito/saldo/origens preservados e reconciliados em cópia restaurada antes de instalar atualização real. | QUA-14/19/20 |
| AP-33 — Mobile e falha | Completar T03/T04/T05 sem perder rascunho nem afirmar salvamento quando resposta é incerta. | QUA-08/09/11/12 |
| AP-34 — Evolução cartão | Futuramente 100 bruto, taxa 3, repasse 97: entrada bancária efetiva no repasse, taxa separada e sem duplicar venda. | FIN-05 (E) |
| AP-35 — Evolução recorrente | Futuramente executar gerador duas vezes cria só uma obrigação do período, sem pagamento automático. | FIN-11 (E) |

## 15. Sprints e evolução

| Sprint | Entrega e dependência |
| --- | --- |
| S0 — Revisão de escopo | Restaurante retirado; modelagem detalhada restaurada nesta revisão. Não significa implementação das novas regras. |
| S1 — Cadastros e preços | Pessoas/pagadores/fornecedores, bebidas e diária por pessoa/ocupação; identidade e retratos históricos definidos antes dos novos fluxos. |
| S2 — Hospedagem e dívida | Hospedagem independente do quarto, ocupantes, tarifa por noite, troca, extrato, saída empresarial e título/recebimento mínimo completo. |
| S3 — Caixa e financeiro | Integrar venda de bebida, consumo, liquidações, turnos, estornos e conferência manual; proteger origem financeira antes de ampliar compras. |
| S4 — Compras e estoque | Recebimento integrado, embalagem/custo, obrigação, lote/validade, perdas e inventário com corte; utiliza núcleo financeiro já estabelecido. |
| S5 — Gestão e homologação | Relatórios de pousada/caixa/previsto, origem dos totais, validação de cinco usuários, mobile, instalação e restauração na máquina alvo. |

S2 já inclui a capacidade mínima de receber e cobrar a dívida que cria; ela não espera S3 para funcionar. S3 consolida o financeiro existente, e S4 amplia estoque/compra. Requisitos C/E ficam em backlog explícito, sem novas perguntas ao cliente até o primeiro protótipo. O [plano detalhado](SPRINTS_POUSADA.md) liga entrega a requisito, cenário e dependência.

## 16. Modelo lógico, migração e conclusão por sprint

Antes de cada mudança persistente, especificar chaves, cardinalidades, estados, origem única, valores derivados e retratos históricos da fatia. Não exigir que o cliente escolha esses detalhes. Uma modelagem conceitual pronta não substitui o desenho concreto da migração daquela sprint.

| Item a preservar/revisar | Regra para a transição |
| --- | --- |
| GuestProfile por CPF e Customer/Supplier | Mapear identidades, crédito e documentos legados; prévia de duplicidades e casos ambíguos, sem mescla automática por nome. |
| Reserva por quarto | Criar vínculo de acomodação/hospedagem/origem sem inventar ocupantes ou empresa pagadora de estadias antigas. |
| Consumo por quarto e busca de produto por nome | Vincular somente quando origem puder ser comprovada. Histórico sem produto ou hospedagem confiável fica identificado como legado; não executar nova baixa de estoque. |
| totalValue/paidValue e transações | Reconciliar valor recebido, crédito, estorno e saldos antes de derivar títulos; não produzir receita duplicada na importação. |
| Estoque atual sem lote | Definir corte e saldo de abertura; validade desconhecida não se torna válida por data inventada. Estoque sem classificação precisa de revisão, não migração silenciosa. |
| Valores atuais de estados e versões | Manter mapeamento explícito e compatibilidade; não invalidar confirmações nem repetir efeitos antigos. |
| Restaurante arquivado | Não apagar tabelas, histórico financeiro ou auditoria; nenhuma migração mistura o saldo arquivado com bebidas. |
| Ambiente e recuperação | Backup antes da migração; execução em cópia isolada, relatório de diferenças e restauração ensaiada. Migração deve ser compatível ou atualização precisa de janela e estratégia de recuperação definida. |

Migração não precisa inventar história ausente. Toda diferença de saldo não explicada impede a ativação da nova regra até ser resolvida; relatórios de legado permanecem acessíveis. Banco vazio operacional é permitido na instalação inicial confirmada, mas futuras atualizações e demonstração não são autorização para apagar uma produção preenchida.

Uma sprint termina com fluxo utilizável, dados e histórico coerentes, permissões/reenvios/conflitos testados, mobile no caminho afetado, migração avaliada, documentação atualizada e commit por tarefa. Primeiro protótipo usa dados fictícios e caminhos S1; não exige nova rodada de perguntas para decisões técnicas.

## 17. Evidências e referências

| Arquivo atual | Evidência e limite |
| --- | --- |
| [schema Prisma](../prisma/schema.prisma) | S1: identidade estável em Customer, papéis, vínculo de GuestProfile/Supplier, capacidade, LodgingTariff e composição/pagador da reserva. CPF legado permanece como chave de compatibilidade. Consumo por quarto, compra integrada, hospedagem independente e saldo por lote ainda dependem das sprints seguintes. |
| [operações](../lib/server/operations.ts) | Quitação obrigatória no check-out atual; consumo baixa produto procurado por descrição e pagamento remove conjunto de consumo. Necessidade de identidade/origem e histórico novos. |
| [navegação](../components/dashboard-shell.tsx) | Cadastros reúne pessoas, fornecedores, quartos/tarifas e bebidas. Exclusão do restaurante não significa conclusão de S2–S5. |
| [regras atuais](REGRAS_NEGOCIO.md) | Base validada de preço, cancelamento, crédito, caixa e estoque a preservar; ainda distingue fluxo atual do alvo empresarial. |
| [permissões](PERMISSOES.md), [concorrência](CONCORRENCIA.md) | Infraestrutura existente a estender, não reescrever do zero. |
| [notificações](NOTIFICACOES.md), [logs](LOGS.md) | Eventos/auditoria e rastreabilidade preservados. |
| [demonstração](DEMONSTRACAO.md), [produção](PRODUCAO.md) | Isolamento, manutenção e recuperação. |
| [avaliação anterior](AVALIACAO_ERP_PEQUENA_EMPRESA.md) | Diagnóstico histórico; não amplia o escopo aprovado. |

A pesquisa de referências externas da versão 0.3 continua preservada em sua seção 2. Organização por função, pessoas reutilizáveis, transações rastreáveis, estoque por lote e obrigação versus pagamento continuam referências de desenho; cozinha e contratos de refeições saem da aplicação. Não é necessário adicionar produtos externos ou infraestrutura para seguir essas práticas.

**Glossário:** pagador = responsável pela dívida; hospedagem = permanência independente do quarto; alocação = parte de pagamento aplicada a parcela; FEFO = retirada do lote válido que vence antes; prestação ≠ recebimento; RPO/RTO = perda de dados tolerada/tempo de recuperação pretendido.

| Versão | Alteração |
| --- | --- |
| 0.3 | Modelagem completa pousada/restaurante; mantida integralmente no arquivo. |
| 0.4 | Retirada do restaurante; resumo ativo excessivamente curto. |
| 0.5 | Restaura detalhes da pousada, mantém IDs e backlog, adiciona auditoria de todos os requisitos e sprints com dependências/aceitação. |
| 0.6 | Registra S1 implementada, compatibilidade das identidades legadas, capacidades, tarifas e preços acordados; preserva requisitos e cenários das etapas seguintes. |
| 0.7 | Vínculo opcional pessoa/empresa e sugestão de pagador, sem alterar operações anteriores. |
| 0.8 | Registra S2 e suas relações de origem, migração e roteiro de aceite; preserva integralmente o backlog S3–S5. |
