# Plano de usabilidade mobile

Data: 08/10/2026. Estado: interface mobile implementada; validação de layout e navegação na demonstração. Homologação de teclado e gestos em aparelhos reais permanece necessária.

## Objetivo

Permitir que recepção, restaurante, estoque e supervisão realizem suas tarefas pelo celular com leitura clara, poucos deslocamentos e ações seguras. Manter a identidade visual atual e a experiência de desktop. A solução continua sendo o aplicativo web existente: React, Tailwind e Radix, sem aplicativo nativo ou nova biblioteca de interface.

## Diagnóstico verificado

Inspeção visual na demonstração Docker atualizada, em viewport de 390 × 844, com dados fictícios, sem confirmar operações. Revisão do código do shell, cabeçalho, mapa, financeiro, caixa, restaurante, estoque e componentes compartilhados. A instalação em localhost:3000 não foi atualizada por este trabalho. A emulação de largura não substitui testes de teclado e navegador em celular real.

| Problema | Evidência | Consequência |
| --- | --- | --- |
| Cabeçalho global ocupa muito espaço | Nome, sessão, indicadores de quartos e seletor de módulos aparecem em todas as áreas | Informações de ocupação competem com tarefas de financeiro e caixa |
| Navegação principal escondida no seletor | Dez destinos para administrador, acessados por uma lista suspensa | Trocas frequentes exigem abrir e procurar novamente |
| Mapa começa tarde | Primeiro quarto começa aproximadamente a 595 px do topo, incluindo o aviso da demonstração | Pouca informação operacional visível na primeira tela |
| Muitas camadas de navegação no financeiro | Indicadores globais, quatro resumos financeiros e oito abas em quatro linhas | A lista de vencimentos começa abaixo da primeira tela |
| Cartões derivados de tabela sem hierarquia própria | Table/mobileColumns replica os campos em duas colunas com rótulos repetidos | Mais altura e pouca distinção entre dado principal e secundário |
| Catálogo e carrinho separados no caixa | Catálogo tem limite de 45dvh com rolagem interna; carrinho aparece abaixo | Usuário alterna entre duas rolagens e perde o total de vista |
| Formulários ainda aproveitam a grade do desktop | Nova despesa coloca valor/data e parcelas/intervalo lado a lado | Campos estreitos, especialmente datas; piora provável com teclado aberto |
| Adaptação global excessiva | CSS transforma todos os TabsList em grade de duas colunas e altera todas as tabelas optantes pelo mesmo padrão | Cada tarefa fica subordinada à mesma solução de layout |

Já existem melhorias a preservar: navegação principal filtrada por permissão, botões com área mínima em telas pequenas, fontes de inputs a 16 px, limite dinâmico de altura dos diálogos, tabelas adaptáveis e proteção de rascunhos/concorrência. O problema restante é principalmente organização e fluxo, não só largura.

## Pesquisa e decisões

1. [Material Design: layouts adaptativos](https://m3.material.io/foundations/layout/canonical-examples/overview) orienta adaptar navegação, conteúdo e painéis ao espaço disponível. Aplicação: lista e detalhe em telas separadas no celular, mantendo painéis lado a lado quando houver espaço.
2. [Material Design: app bars](https://m3.material.io/components/app-bars/) recomenda título da página e poucas ações essenciais no topo. Aplicação: cabeçalho compacto do módulo, notificações e conta; indicadores específicos no corpo da área correspondente.
3. [W3C: tamanho mínimo dos alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) define 24 × 24 CSS px no nível AA, com exceções de espaçamento. Adotar 44–48 px como meta própria de conforto para ações e campos, não confundir essa meta com o mínimo normativo.
4. [W3C: reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow) estabelece referência de 320 CSS px sem perda de funcionalidade e sem rolagem em duas direções para conteúdo comum. Aplicação: nenhuma rolagem horizontal da página; comparações e agendas podem ter uma região própria identificada.
5. [NN/g: tabelas no mobile](https://www.nngroup.com/articles/mobile-tables/) recomenda selecionar os dados relevantes e manter legibilidade; girar o telefone é último recurso. Aplicação: lista resumida para operação e tabela com colunas escolhidas para comparações que realmente precisam dela. Cartões não são substituto universal de tabelas.
6. [GOV.UK: páginas de perguntas](https://design-system.service.gov.uk/patterns/question-pages/) organiza formulários por informação e tarefa. Aplicação: formulários curtos em uma coluna; etapas somente em fluxos extensos, como reserva/check-in, sem transformar toda edição pequena em um assistente.
7. [W3C: foco não encoberto](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) alerta para barras fixas que escondem controles. Aplicação: ações fixas reservam espaço, respeitam áreas seguras e são verificadas com teclado aberto, zoom e foco.

As escolhas de quantidade de atalhos, formato dos cartões e metas de densidade abaixo são propostas específicas para esta pousada; não são requisitos impostos pelas referências.

## Etapa 1 — Estrutura de navegação e cabeçalho (prioridade alta)

- Criar uma barra inferior mobile com até quatro destinos operacionais autorizados e “Mais”. Para administrador: Mapa, Reservas, Caixa, Restaurante e Mais. Para outros perfis, filtrar esses atalhos e completar os espaços com destinos autorizados em uma ordem estável; estoque não deve precisar abrir “Mais” para sua tarefa principal.
- “Mais” abre uma lista de todos os módulos permitidos, agrupados em operação, gestão e administração, com ícones e nomes. O módulo selecionado permanece claramente identificado, mesmo quando está em “Mais”. Reutilizar tabPermissions/can; não criar regras de acesso paralelas.
- Cabeçalho mobile de uma linha principal com título do módulo, notificações e menu da conta. Nome completo da pousada, usuário e sair vão no menu da conta. Textos longos têm tratamento definido.
- Indicadores de quartos aparecem no Mapa. Resumos financeiros aparecem no Financeiro. Alertas importantes continuam acessíveis, sem repetir todos os números em todas as áreas.
- Preservar módulo ativo e posição/filtros ao alternar. Avisar antes de descartar formulário alterado. Barra inferior fica fora da área de edição quando uma tarefa de tela cheia está aberta.
- Manter a navegação desktop e definir comportamento de tablet pela largura disponível; o corte atual de 640 px precisa ser reavaliado com quantidade real de destinos e textos.

Arquivos principais: dashboard-shell.tsx, dashboard-header.tsx, active-tab-context.tsx; componentes novos de navegação mobile e menu de módulos.

Aceite: qualquer módulo autorizado em até dois toques a partir da navegação; destinos diários prioritários em um toque; nenhuma opção proibida; barra não cobre conteúdo ou foco.

## Etapa 2 — Listas, filtros e detalhes (prioridade alta)

- Cabeçalho da seção com título e uma ação principal. Busca direta quando importante; filtros avançados em painel com “Aplicar”, “Limpar” e quantidade de filtros ativos.
- Subnavegação com até três opções frequentes por área. Demais destinos em menu “Outras opções”. Evitar grade automática com quatro linhas; também evitar esconder oito destinos em uma faixa sem indicação.
- Novo padrão de lista operacional: nome/identificação, estado, valor ou prazo relevante e ação principal. Campos secundários ficam nos detalhes. IDs técnicos não ocupam a primeira linha quando não ajudam a tarefa.
- Manter tabelas para relatórios comparativos, com colunas selecionáveis, identificação da linha e indicação de rolagem local. Não aplicar conversão genérica a todas as tabelas.
- Paginar listas extensas; manter busca, filtros e ordenação. Não implementar virtualização antes de medir uma necessidade real.
- Criar estados consistentes de carregamento, vazio, erro e dados desatualizados. A mensagem de sincronização não deve deslocar toda a tela repetidamente.

Arquivos: ui/table.tsx, ui/tabs.tsx, globals.css, listas de reservas, financeiro, clientes, fornecedores, hóspedes e auditoria. Criar lista de registro e barra de filtros reutilizáveis, com configuração explícita por tela.

Aceite: valor, estado e ação de um registro são identificáveis sem abrir todos os seus detalhes; funcionalidades secundárias continuam acessíveis; leitura por leitor de tela preservada.

## Etapa 3 — Mapa e reservas (prioridade alta)

- Mapa inicia com data atual compacta, busca por quarto/hóspede e filtros úteis. Agenda semanal completa passa a expansão opcional; remover a repetição da miniagenda de todos os cartões na vista compacta.
- Resumo de ocupação compacto e expansível. “Gerenciar quartos” vai no menu da seção; reservar, check-in e atender hóspedes têm prioridade visual.
- Quarto em lista/cartão compacto com número, estado escrito, hóspede e saída/saldo quando pertinente. Uma ação contextual principal; demais ações nos detalhes. Estado não depende só de cor.
- Reservas em lista com hóspede, quarto, período e estado. Nova reserva/check-in pode ter etapas: hóspede, período/quarto, valores e revisão. Voltar não apaga campos.
- Não deixar check-out disponível quando a regra exigir quitação. Preservar os mesmos bloqueios e aprovações do servidor.

Arquivos: room-grid.tsx, room-card.tsx, mini-timeline.tsx, reservations-tab.tsx e checkin-modal.tsx.

Aceite: em 390 × 844, meta de mostrar dois quartos compactos úteis na primeira tela operacional, considerando aviso de demonstração quando presente. Fluxos de reserva e hospedagem funcionam em retrato.

## Etapa 4 — Caixa, restaurante, estoque e financeiro (prioridade alta)

| Área | Mudança proposta |
| --- | --- |
| Caixa | Catálogo usa a rolagem principal; resumo fixo do carrinho mostra itens e total; tocar abre revisão. Busca e quantidade acessíveis; finalizar exige resumo completo e confirmação |
| Restaurante | Mesas com estado e total claros; comanda de tela cheia no celular; adição de itens em etapa própria, retorno preserva o pedido; quantidade e remover separados |
| Estoque | Produto, saldo, unidade e alerta na lista; busca e filtro de saldo; movimentação em formulário focado; ação de estoque não misturada à edição de cadastro |
| Financeiro | Vencimentos, Recebimentos e Transações como entradas frequentes; cadastros e fechamento em menu; resumo recolhível; títulos destacam valor, prazo e situação |
| Relatórios/auditoria | Filtros recolhíveis, resumo inicial e detalhe sob demanda; comparação tabular e exportação continuam disponíveis |

Arquivos: pos-tab.tsx, restaurant/restaurant-tab.tsx, restaurant/order-sheet.tsx, stock/stock-tab.tsx, financial-tab.tsx e módulos relacionados.

Aceite: adicionar itens e revisar carrinho sem procurar uma seção distante; sem rolagem interna concorrendo desnecessariamente com a página; total e destinatário visíveis antes de confirmar dinheiro.

## Etapa 5 — Formulários, diálogos e feedback (prioridade alta)

- Formulários operacionais extensos em tela cheia no celular, com título/voltar, corpo rolável e ações reservando espaço. Diálogos pequenos continuam para confirmações curtas. Não converter tudo em bottom sheet.
- Inputs em uma coluna; pares só quando couberem com folga. Datas, dinheiro e nomes têm largura adequada. Usar inputMode/autocomplete apropriados e rótulos visíveis, com formatos brasileiros apresentados claramente.
- Meta de 44–48 px de altura/área de interação; texto principal e entradas legíveis, sem reduzir a fonte para caber. Revisar checkbox, close, select, incremento e ações de ícone, não só Button.
- Área inferior respeita env(safe-area-inset-bottom) e altura dinâmica. Validar teclado real; evitar vários painéis empilhados. Cadastro auxiliar abre como etapa que retorna ao formulário original.
- Erros junto ao campo e resumo quando necessário; foco vai para o primeiro erro. Envio mostra progresso e mantém o rascunho em falha. Sucesso financeiro fica explícito e não depende apenas de um toast rápido.
- Preservar tokens, recibos, aprovação e resolução de conflitos recém-implementados. Comparação de conflito em uma coluna, com valores claros e ações sem corte.
- Respeitar prefers-reduced-motion; revisar transições globais e cores/contraste. Não usar animação contínua como único sinal de urgência.

Arquivos: ui/dialog.tsx, ui/sheet.tsx, ui/input.tsx, ui/button.tsx, payment-fields.tsx, operation-approval.tsx, conflict-review.tsx e formulários de cada módulo. Criar um componente explícito para tarefa mobile, aproveitando os controles atuais.

## Etapa 6 — Homologação e entrega

Implementar em mudanças pequenas: (1) shell e controles; (2) mapa/reservas; (3) financeiro/listas; (4) caixa/restaurante/estoque; (5) formulários restantes e revisão de acessibilidade. Entregar primeiro a recepção e o fluxo de venda, sem esperar uma reformulação visual completa.

Validar em 320, 360, 390, 430, 768 px e desktop de 1280 px, em retrato e paisagem. Testar navegador Android e Safari/iPhone quando disponíveis. O viewport automatizado cobre layout; o celular real cobre teclado, gestos, áreas seguras e comportamento do navegador.

Critérios de conclusão:

- Página sem rolagem horizontal e conteúdo/ações sem corte a 320 px; regiões realmente bidimensionais têm rolagem local identificada.
- Foco e botões de confirmação acessíveis com teclado aberto e zoom; navegação por teclado/leitor de tela mantém nomes e ordem coerentes.
- Usuário encontra e conclui buscar quarto, reservar/check-in, lançar consumo, montar venda, receber título e movimentar estoque em retrato.
- Comparar toques, deslocamentos e tempo dessas tarefas antes/depois; remover deslocamentos evitáveis sem retirar revisões de segurança. Metas de tempo só após uma linha de base, sem prometer percentual arbitrário.
- Cinco ou mais registros realistas por lista, nomes longos, valores grandes, lista vazia, erro de rede, permissão reduzida e conflito de edição.
- Duas contas/dispositivos recebem atualizações sem perder o rascunho; nenhuma mudança de layout contorna validações do servidor.
- Testes de integração de negócio existentes continuam passando; novos testes cobrem navegação por permissão, rascunhos, estados de envio e abertura/fechamento de tarefas. Verificação visual em larguras reais, não snapshots que apenas repetem classes CSS.
- Build, tipos e lint passam; desktop não perde ações nem informações. Homologar primeiro na demonstração, depois atualizar a instalação principal em janela combinada.

## Limites de manutenção

Reutilizar controles, permissões e operações existentes; compartilhar os dados/regras entre representações desktop e mobile. Evitar duas aplicações independentes. Trocar regras globais de CSS por variantes explícitas à medida que os módulos forem migrados, sem remover proteções úteis de uma vez.

PWA, operação offline, notificações push, gestos exclusivos e redesenho completo da marca ficam fora deste plano. Nenhum deles resolve a hierarquia e a organização observadas. A pesquisa orienta as escolhas; a validação com quem trabalha na pousada decide os ajustes finais.

## Implementação em 08/10/2026

As variantes novas são limitadas a larguras abaixo de 640 px. A navegação e os painéis de desktop/tablet continuam usando a apresentação anterior. Não foram alterados banco, operações, permissões ou regras de negócio.

- Cabeçalho compacto e barra inferior com quatro atalhos autorizados e menu de módulos agrupados; estados dos módulos visitados são preservados no celular, sem montar todos os módulos antecipadamente.
- Subnavegação com três destinos frequentes e menu de seções secundárias. Financeiro prioriza vencimentos, contas a receber e transações, com resumo recolhível.
- Mapa com busca por quarto/hóspede, agenda opcional, acesso compacto ao gerenciamento e cartões sem espaçadores/miniagendas repetidas.
- Listas configuradas explicitamente em reservas, despesas, transações, clientes, hóspedes, fornecedores, recebimentos e estoque. Identificação principal, campos prioritários e ações visíveis; dados secundários em “Ver detalhes”. Paginação de 15 registros nessas listas no celular; desktop mantém a lista completa.
- Catálogo do caixa usa a rolagem da página. Resumo fixo do carrinho leva à revisão; itens e quantidades são preservados ao trocar de módulo. Controles de quantidade e remoção têm nomes acessíveis e disposição própria para celular.
- Restaurante e estoque recolhem resumos extensos. Cadastros auxiliares do restaurante ficam no menu Gerenciar. A comanda ocupa a largura do celular e separa produto dos controles de quantidade/adicionar. Auditoria mantém busca direta e recolhe os filtros avançados, indicando filtros ativos. Os filtros existentes continuam aplicados ao selecionar, com indicação explícita, para não introduzir confirmação sem efeito.
- Formulários operacionais optam por tarefa de tela cheia, corpo rolável e rodapé reservado. Campos em uma coluna, alvos de toque maiores e áreas seguras respeitadas. Confirmações curtas continuam em diálogo. Formulários de lançamento optam por proteção de rascunho ao cancelar/fechar no celular; telas de consulta não disparam esse aviso.
- Movimento reduzido respeitado no celular. Validação, aprovações, recibos e revisão de conflitos continuam usando os componentes e operações existentes.

Não foi criado um assistente obrigatório de etapas para reserva/check-in: a proposta previa essa opção; os formulários atuais cabem em uma tarefa de tela cheia e mantêm seus campos ao editar. Tampouco foram introduzidos virtualização, aplicativo nativo, dependências ou mecanismos de edição paralelos.

A validação de emulação não cobre teclado virtual de Android/iPhone, gestos do Safari ou áreas seguras físicas. A instalação principal deve ser atualizada em janela combinada após essa homologação; a demonstração é o ambiente de revisão desta entrega.

### Validação da entrega

- 250 testes unitários/comportamentais aprovados (243 existentes e 7 novos). Casos novos cobrem atalhos autorizados, perfil de estoque, cancelamento com rascunho, cancelamento desktop, portais auxiliares e paginação após filtrar.
- Tipos e lint sem erros; imagem de demonstração construída com `next build` e servidor saudável.
- Inspeção no navegador em 320, 360, 390, 430, 768 e 1280 px. Em 320 px, financeiro e carrinho não ultrapassam a largura da página; formulário de despesa ocupa a tela a partir de x=0/y=0 e mantém o rodapé dentro do viewport.
- Em 390 × 844, com aviso de demonstração e rolagem no topo, os dois primeiros quartos ficaram entre y=292–546 e y=562–752; a navegação começa em y=775.
- Navegação, menu de seções, expansão de detalhes, revisão do carrinho, formulário financeiro, comanda existente e listas de estoque conferidos sem concluir operações financeiras. Carrinho preservado ao trocar de módulo.
- Comparação de capturas do mapa em desktop de 1280 px: diferença restrita ao alerta animado do quarto 101; estrutura e demais pixels preservados. Tablet mantém a navegação anterior.
- Não foram repetidos os testes de integração PostgreSQL nesta alteração de apresentação. Não foram executados testes em aparelho físico, teclado virtual ou Safari. Não foi atualizada a instalação principal nem enviado push.
