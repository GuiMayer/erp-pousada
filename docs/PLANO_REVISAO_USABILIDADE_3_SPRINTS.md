# Revisão de usabilidade — plano de correção em três sprints

**Data:** 22/10/2026. **Referência de código:** `5558e50`.
**Fonte:** documento “Revisão do ERP Pousada Sol & Mar”, análise das dez telas de 22/10/2026, fornecido pelo usuário.

Este plano complementa as sprints funcionais já entregues. As três etapas abaixo são de revisão, não uma renumeração das sprints 1–6. Não houve alteração de código nesta análise. As constatações foram verificadas por leitura da implementação atual; observações de corte, truncamento e tamanho em pixels precisam de reprodução visual durante a execução.

**Execução:** a sprint 1 foi implementada em 22/10/2026; consulte [entrega e validação](ENTREGA_REVISAO_SPRINT_1.md). A sprint 2 foi implementada; consulte [entrega, validação e limites da conferência visual](ENTREGA_REVISAO_SPRINT_2.md). A sprint 3 continua planejada.

## Direcionamento confirmado pelo usuário

- O menu de abas fica acima do resumo de quartos. O resumo aparece **sempre e somente no Mapa**, sem opção para escondê-lo, conforme direcionamento posterior do usuário.
- A pousada vende **somente bebidas**. Corrigir catálogo, categorias e exemplos de demonstração. O restaurante continua arquivado, sem reativar sua interface.
- Padronizar **sub-abas** nos módulos. Manter navegação lateral com busca e agrupamentos em Configurações.
- Preservar o fluxo atual de consumo, o controle do caixa recém-centralizado na Frente de Caixa, as permissões e a integridade dos pagamentos e do estoque.
- Não introduzir funções fiscais, motor financeiro paralelo, reescrita geral de telas ou tratamento hipotético de instalações antigas.

## Verificação das críticas

| ID | Observação | Resultado no código atual | Encaminhamento |
| --- | --- | --- | --- |
| R01 | Resumo de quartos fora do Mapa | Confirmado: `DashboardHeader` verifica permissão e preferência, mas não a aba ativa. Os 230 px citados dependem da viewport; não são uma medida universal. | Sprint 1: sempre no Mapa, abaixo das abas e sem preferência de ocultação. |
| R02 | Catálogo duplicado e mistura de produtos | Confirmado: Cadastros e Estoque renderizam `ProductsManagementTab`. O exemplo do navegador inclui lanches, doces e serviços. | Sprint 1: cadastro único de bebidas em Cadastros; Estoque fica com operação de estoque. |
| R03 | Subnavegação e títulos inconsistentes | Confirmado: existem composições e tamanhos distintos nos módulos. | Sprint 2: componentes comuns de cabeçalho e sub-abas; Configurações mantém a lateral. |
| R04 | Saldos diferentes para a mesma pessoa | Há causa concreta nos exemplos: `lib/demo-data.ts` cria títulos de R$ 320/480/650 sem `sourceStayId`, com descrição de saldo de hospedagem, independentemente das estadias. Isso não prova que o núcleo PostgreSQL duplica dívidas. | Sprint 1: reconciliar cenários pela origem e validar o núcleo. Não forçar igualdade entre contas diferentes de uma pessoa. |
| R05 | Reserva de R$ 600 com botão Receber R$ 500 | O botão calcula o saldo; a coluna mostra o total. O sinal pode explicar a diferença, mas a lista não o esclarece. | Sprint 1: identificar total, recebido e saldo sem repetir valores em botões longos. |
| R06 | Receita Total parece apenas PDV | Confirmado no painel de demonstração: `useReports` soma `posSales`. A tela conectada ao banco usa outro painel. | Sprint 1: explicitar o significado e alinhar os indicadores da demonstração e do banco. |
| R07 | Falta ocupação e diária média | Já existem no relatório gerencial de Hospedagem, em `management-reports.ts`. Planejamento é orçamento, não o destino desses indicadores. | Sprint 1: tornar Hospedagem fácil de encontrar e mostrar os indicadores na demonstração. Reutilizar os cálculos existentes. |
| R08 | Moedas e percentuais inconsistentes | Confirmado: há `toFixed` interpolado diretamente em botões, tabelas e métricas. | Sprint 1: formatadores pt-BR compartilhados na apresentação. |
| R09 | Acentos ausentes | Confirmado em rótulos de interface e exemplos. | Sprint 2: revisão de textos e dados fictícios, preservando nomes/documentos digitados pelo usuário. |
| R10 | Operação e tipo vazios na auditoria | A tela suporta ambos. Os exemplos copiam registros sem garantir esses campos; novos emissores também devem ser conferidos. | Sprint 1: exemplos e produtores estruturados; não inventar classificação por análise do texto da ação. |
| R11 | Badges de auditoria ilegíveis | Há combinação de fundo translúcido com `warning-foreground` escuro no modo noturno. O problema é consistente com a implementação. | Sprint 2: tokens adequados para badges, conferidos nos dois temas. |
| R12 | Filtros da auditoria truncados | A composição deve ser reproduzida nas larguras da revisão. | Sprint 2: dimensionamento e comportamento responsivo dos filtros. |
| R13 | Pizza cortada, cores e legenda divergentes | Há causas no código: raio fixo de 100, contêiner com `aspect-video` e chaves `Débito/Crédito` diferentes das formas normalizadas `Cartao Debito/Cartao Credito`. Ambas podem cair na mesma cor de fallback. | Sprint 2: geometria responsiva e mapa único de identificador, rótulo e cor. |
| R14 | Datas mm/dd/yyyy | Histórico/Auditoria usam entradas nativas `type=date`; a aparência depende do navegador. Isso não demonstra armazenamento em formato americano. | Sprint 2: apresentação de data consistente e acessível, conservando ISO nos dados e fuso da operação. |
| R15 | Consumo espremido, conta truncada e vazio | O padding foi corrigido na entrega anterior. Ainda há `max-h-48` no catálogo, independentemente da altura disponível. Truncamento e distribuição precisam de validação visual. | Sprint 2: altura flexível, seleção de conta legível e rolagem utilizável sem alterar a entrega/cobrança. |
| R16 | Ícone de produto do PDV ambíguo | O produto é um botão que adiciona ao carrinho; o ícone genérico não comunica a ação por si só. | Sprint 2: indicação de adicionar, rótulo acessível e confirmação discreta, sem modal adicional. |
| R17 | Reservas sem busca/filtros e ações repetitivas | Confirmado: a lista agrupa reservas pendentes, mas não implementa busca ou filtros. | Sprint 3: filtros úteis à chegada, tabela compacta e desempenho com 200 reservas. |
| R18 | Telefones vazios e WhatsApp | Cadastro de telefone existe e aceita vazio. A lista ainda o exibe como texto e não oferece WhatsApp. | Sprint 3: exemplos com telefones fictícios e ação explícita de WhatsApp apenas para telefone válido. |
| R19 | Aviso de conciliação muito pequeno | É uma questão de apresentação; preservar o aviso e a distinção entre saldo interno e conciliação. | Sprint 2: texto legível próximo do saldo, sem mensagem repetida em cada linha. |
| R20 | Clicar na auditoria para ver detalhes | Já há expansão e antes/depois quando `metadata` contém os dados. | Sprint 2: melhorar a descoberta e o acesso à expansão; não reconstruir a auditoria. |
| R21 | Medir os fluxos decisivos | A revisão não testou os formulários completos. Não há evidência nela sobre tempo real de uso. | Sprint 3: medir reserva, check-in, consumo, saída e fechamento com roteiro operacional. |

## Sprint 1 — Números confiáveis e escopo coerente

**Objetivo:** o cliente conseguir explicar cada valor e encontrar um único cadastro de bebida. Esta etapa precede a padronização visual para evitar dar acabamento a indicadores ou dados enganosos.

### Tarefas

1. **Distinguir as medidas financeiras.** Definir rótulos consistentes para valor contratado, sinal/recebido, saldo, venda de bebida, recebimento financeiro e diária prestada. O total de vendas não equivale a dinheiro recebido: uma venda marcada na hospedagem não pode ser contada novamente quando a hospedagem é quitada. Transferências, fundos de caixa e suprimentos não são receita.
2. **Conferir os saldos pela origem.** Validar a cadeia reserva → hospedagem → lançamentos/pagamentos → título empresarial → recebimento. Identificar claramente a hospedagem ou o título que cada valor representa. Manter cálculos reutilizáveis e servidor como autoridade no modo PostgreSQL; não implementar regras diferentes em cada tela.
3. **Recriar os cenários financeiros de demonstração com vínculos reais.** Incluir estadia ativa, reserva com sinal, consumo quitado, consumo a receber e hospedagem empresarial encerrada com dívida. Gerar títulos a partir das respectivas hospedagens; dívidas independentes precisam de origem e descrição próprias. Exemplos continuam relativos ao início da demonstração. Não criar lançamentos para “fazer o número bater”.
4. **Corrigir o escopo dos relatórios.** Acesso inicial a Hospedagem: diárias acordadas, prestadas, ocupação e diária média, respeitando os critérios já existentes. Bebidas permanece uma seção própria. Diferenciar recebimentos e prestação do serviço. A demonstração deve usar os mesmos conceitos do painel conectado, com cenário de valores conhecidos; Planejamento continua destinado a orçamento.
5. **Unificar apresentação numérica.** Usar os mesmos formatadores de moeda, número e percentual em listas, botões, gráficos, tooltips e exportações. Separar formatação visual de cálculo, parsing de campos e serialização. Não substituir aritmética em centavos por strings formatadas.
6. **Unificar o cadastro de bebidas em Cadastros.** Remover a edição duplicada do Estoque. Manter lá saldos, compras, lotes, validade, perdas e inventários. Atalhos operacionais podem abrir o cadastro único preservando o rascunho. Atualizar os destinos de links, notificações e permissões que apontavam para o catálogo no Estoque.
7. **Ajustar os exemplos e o catálogo ativo a bebidas.** Corrigir o enquadramento por identidade/classificação estável, sem depender de o texto da categoria conter “bebida”. Preservar o módulo de restaurante arquivado e não remover produtos referenciados por operações sem analisar os vínculos.
8. **Qualificar os exemplos de auditoria e os emissores atuais.** Novos registros devem informar operação e entidade; antes/depois e motivo são registrados conforme a ação. Não gerar alterações fictícias para preencher a tela.
9. **Restringir o resumo de quartos ao Mapa.** Manter o resumo sempre abaixo das abas no Mapa e remover sua preferência de ocultação. Não ocupar altura em Financeiro, Estoque, Cadastros, Relatórios ou Configurações.

### Aceite

- Reserva de R$ 600 com sinal de R$ 100 identifica total, recebido e saldo de R$ 500, sem sugerir divergência.
- A mesma hospedagem apresenta saldo coerente no Mapa, ficha, recebimento e título quando aplicável. Duas dívidas distintas do mesmo cliente continuam distintas e identificadas.
- Recebimento parcial, pagamento de bebidas, estorno, crédito e saída empresarial não duplicam receita, título, pagamento ou baixa de estoque.
- Indicadores conhecidos de hospedagem e bebidas reconciliam com as origens e com as exportações; reserva futura e sinal não elevam diária já prestada.
- Existe um único local para cadastrar/editar bebidas. Estoque e PDV usam o mesmo produto e preço.
- Nenhuma tela fora do Mapa mostra o resumo de quartos, inclusive após trocar de módulo e recarregar.
- Testes de integração financeira e das permissões passam no PostgreSQL isolado; exemplos do navegador também são conferidos. A correção do seed não serve como prova de correção do banco.

**Commits sugeridos:** resumo do Mapa; cadastro único; conceitos e saldos; cenários financeiros/auditoria; indicadores; formatação numérica. Dividir de acordo com as dependências reais.

## Sprint 2 — Interface consistente e espaço útil

**Dependência:** conceitos, destinos e rótulos definidos na Sprint 1.
**Objetivo:** padronizar a leitura e os controles com componentes pequenos e compartilhados, preservando o estilo existente.

### Tarefas

1. **Cabeçalho de página compartilhado.** Título, descrição opcional e ações com escala tipográfica e espaçamento consistentes. Evitar título repetido e grandes áreas vazias; não refazer o cabeçalho global nem a navegação principal sem necessidade.
2. **Sub-abas compartilhadas.** Um padrão para Cadastros, Estoque, Financeiro e Relatórios, com estados ativo/hover/foco, teclado, permissões e adaptação a celular. Os filtros continuam controles de filtro; não devem parecer um segundo conjunto de abas. Configurações mantém sua lateral com busca.
3. **Auditoria legível.** Badges contrastantes nos dois temas, filtros legíveis e ação “Ver detalhes” identificável com teclado e toque. Reutilizar a expansão existente e apresentar antes/depois em linguagem compreensível quando disponíveis. Mostrar ausência de detalhes com clareza, sem inventá-los e sem expor segredos.
4. **Gráficos consistentes.** Normalizar identificadores de meios de pagamento; usar a mesma correspondência de cores na fatia, legenda e tooltip. Ajustar raio, altura e margens à área disponível. Exibir formas com valor zero/ausência e estados vazios de forma deliberada.
5. **Datas pt-BR previsíveis.** Centralizar o seletor/apresentação acessível; usar o calendário pt-BR existente quando adequado. Manter datas ISO no transporte e preservar as datas comerciais sem deslocá-las ao converter fusos. Conferir também navegador com idioma inglês. Manter formatos específicos já solicitados para intervalos de diárias quando aplicáveis.
6. **Consumo lateral.** Preservar o padding recém-adicionado. Distribuir catálogo, itens e rodapé pela altura disponível, sem altura fixa que desperdice espaço e sem rolagens que prendam o usuário. Deixar conta selecionada identificável e opções legíveis. Preservar os campos ao abrir caixa e o comportamento atual de lançamento, pagamento e estoque.
7. **Clareza de ações e textos.** Revisar acentos, nomes dos botões, labels e ícones; indicar que o produto do PDV adiciona ao carrinho, sem confirmação extra. Dar legibilidade ao aviso de saldo interno/limites de conciliação. Não alterar nomes próprios, marcas ou dados livres de clientes automaticamente.

### Aceite

- Verificação visual em 1366 × 768 e 1280 × 720 no desktop; 390 × 844 e 360 × 800 no celular; ambos os temas. Verificar zoom de 200%, foco e navegação por teclado nos controles alterados.
- Títulos e sub-abas seguem o mesmo padrão; Configurações conserva sua organização lateral e as permissões continuam filtrando os destinos.
- Pizza completa sem corte; quatro meios de pagamento têm identificadores, rótulos e cores correspondentes em gráfico e legenda.
- Filtros da auditoria e seleção de conta podem ser compreendidos sem adivinhar texto truncado. Os detalhes já registrados permanecem acessíveis.
- Consumo usa melhor a altura e mantém produtos, quantidades e pagamentos durante o atendimento; catálogo com vários itens e nomes de conta longos é testado.
- Datas exibem a convenção definida em navegador pt-BR e en-US, sem mudar o dia persistido. Testar intervalo, virada de mês e data sem horário.

**Commits sugeridos:** cabeçalhos/sub-abas; auditoria; gráficos; datas; consumo; textos e clareza de ações.

## Sprint 3 — Atendimento rápido e homologação integrada

**Dependência:** navegação e componentes estabilizados nas sprints anteriores.
**Objetivo:** testar o uso diário completo e resolver gargalos comprovados, sem acrescentar novas áreas de gestão.

### Tarefas

1. **Reservas para volume real.** Busca por hóspede, empresa pagadora, quarto e referência; período de chegada e filtros úteis como Hoje, Próximas e Chegada pendente em atraso. A aba continua só para quem ainda vai chegar: canceladas, encerradas e hospedagens iniciadas permanecem nos seus destinos atuais. Não adicionar um filtro de status que traga o Histórico de volta para Reservas.
2. **Ações compactas e previsíveis.** Reduzir repetição de “Receber hospedagem · R$ …” nas linhas. Manter o valor em coluna/área identificada e um botão curto “Receber”, com nome acessível que inclua o contexto. Check-in elegível e abertura de grupo continuam fáceis; ações secundárias ficam nos detalhes/mais ações. Não esconder toda ação frequente em menus apenas para diminuir a quantidade de botões.
3. **Grupos, filtros e desempenho.** Usar massa com pelo menos 200 reservas, vários quartos por grupo e nomes longos. Preservar quartos separados por vírgula e ações individuais dentro do grupo. Definir filtragem antes do agrupamento/paginação sem duplicar grupos nem esconder integrantes silenciosamente; informar quando um grupo contém registros fora do filtro. Adotar paginação ou carregamento progressivo compatível com a consulta existente, sem framework adicional.
4. **Telefone e WhatsApp.** Preservar telefone opcional; validar/normalizar para uso no link e oferecer ação apenas quando for possível montar um número válido, com DDI conferido e alternativa de copiar o telefone. Abrir conversa somente por ação do operador, sem envio automático nem serviço pago. Exemplos usam números fictícios; não enviar mensagens durante os testes.
5. **Medir a rotina completa.** Registrar cliques, preenchimentos, erros e tempo de nova reserva, check-in com/sem reserva, consumo, pagamento misto/parcial, saída empresarial e fechamento. Coletar a linha de base antes das alterações desses fluxos e comparar no mesmo equipamento e cenário; não fixar uma meta de segundos sem medição.
6. **Homologar permissões e estados concorrentes.** Recepção, caixa, supervisor e usuário com permissões limitadas; dois usuários alterando o mesmo atendimento; turno fechado durante pagamento; conexão interrompida e reenvio; cancelamento com/sem sinal e motivo opcional; check-in somente hoje ou retroativo autorizado; datas futuras como reserva. Não mudar as políticas já aprovadas de check-out e cobrança empresarial.
7. **Fechar a documentação de operação.** Atualizar orientações e capturas que ficaram desatualizadas; manter matriz de cada crítica com teste/evidência e registrar o que depende de aceite do cliente.

### Aceite

- Buscar e operar entre 200 reservas sem navegar linha a linha; limpar filtros restaura a consulta e um grupo nunca recebe a ação destinada a outro quarto.
- O fluxo usual conserva os campos ao mudar de tarefa e não acrescenta cliques para lançar consumo, receber ou fazer check-in. Registrar exceções justificadas, como confirmação de dinheiro, desconto ou cancelamento.
- Somente bebidas estão disponíveis na operação da pousada; o restaurante continua fora da interface.
- WhatsApp depende de número válido e clique explícito; ausência de telefone não impede cadastro/reserva.
- Relatório de comparação antes/depois com os mesmos cenários, sem confundir tempo de espera técnica com tempo do operador.
- Testes de tipos, lint, unidade e integração relevantes aprovados, build e verificação visual; nenhuma alteração de saldo/estoque sem origem ou autorização.
- Aceite com o usuário e, quando disponível, uma pessoa da recepção. Uma simulação técnica não é apresentada como homologação do cliente.

**Commits sugeridos:** busca/filtros/paginação de Reservas; ações compactas e grupos; telefone/WhatsApp; correções dos fluxos medidos; documentação de aceite.

## Sequência de execução e limites

1. Executar Sprint 1 e demonstrar números e destinos coerentes.
2. Executar Sprint 2 sobre essa base, incluindo telas desktop e mobile.
3. Executar Sprint 3 e concluir a homologação dos fluxos.

Cada tarefa deve ter teste proporcional ao risco e commit próprio; não fazer push ou deploy automaticamente como parte deste planejamento. Não é necessário um serviço novo para cumprir o plano. Evitar manter dois conjuntos de regras financeiras: compartilhar contratos/seletores puros quando viável, adaptar as fontes de dados e conservar o servidor como autoridade na operação conectada.

Não há decisão de produto pendente para iniciar a Sprint 1 com o direcionamento recebido. Durante a execução, perguntar somente se surgir uma regra de negócio realmente não definida; escolhas rotineiras de espaçamento, componentes e organização técnica pertencem à implementação.
