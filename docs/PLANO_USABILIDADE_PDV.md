# Plano de usabilidade da Frente de Caixa

## Objetivo e limites

No desktop Full HD, manter a página de vendas dentro da janela, com produtos, carrinho, total e ação de pagamento acessíveis sem rolar a página. Listas extensas de produtos ou itens poderão rolar **dentro de seus painéis**; quantidade arbitrária de itens não pode exigir altura ilimitada nem ser escondida.

No celular, reduzir o espaço ocupado por controles secundários e tornar direta a sequência selecionar bebidas → revisar → receber ou lançar na hospedagem. Compactação não significa reduzir alvos de toque ou ocultar valores relevantes.

É uma alteração da interface do PDV e do enquadramento necessário para acomodá-lo. Preservar as operações de venda, recebimento imediato, lançamento na hospedagem, caixa, descontos, estorno, permissões, auditoria, proteção de rascunho, idempotência e baixa única de estoque. Não alterar o fluxo de Consumo aberto pelo Mapa. Usar os mesmos componentes de venda e o mesmo estado para demonstração e PostgreSQL.

## Diagnóstico pelo código

- `components/pos-tab.tsx`: coluna de catálogo sem limite de altura em `lg` (`lg:max-h-none`); a grade cresce com todos os produtos.
- Carrinho sem uma cadeia de alturas limitada: `overflow-y-auto` sozinho não limita o crescimento. Cabeçalho, itens e rodapé precisam de regiões próprias.
- Dois grupos de botões de quantidade são renderizados em cada item. O primeiro só é escondido no mobile por `.mobile-cart-duplicate`; no desktop, ambos ficam disponíveis.
- `components/ui/card.tsx` aplica `py-6`, `gap-6` e cabeçalhos com bastante espaçamento; o PDV acumula esses padrões com seus próprios espaços. Ajustar apenas a variante/composição do PDV, sem reduzir todos os cartões do app.
- `components/dashboard-shell.tsx`: largura máxima de 1280 px e espaços generosos limitam o aproveitamento do Full HD.
- `app/layout.tsx` coloca a faixa da demo antes de `main`; `app/page.tsx` já exige `min-h-screen` no conteúdo. Essa composição pode produzir rolagem mesmo antes de considerar o PDV.
- No celular, o catálogo tem `max-h-[45dvh]` com rolagem interna; o botão de carrinho abre o bloco e chama `scrollIntoView`. Isso combina rolagem da página e do catálogo para uma mesma tarefa.
- Busca por nome e código ocupam dois campos; categorias se repetem nos filtros e nos cartões; desconto geral ocupa espaço mesmo quando não está sendo usado.
- O contexto de caixa já é centralizado em `CashWorkspace`. Sua abertura, fechamento e mensagens devem continuar visíveis e sujeitos às permissões atuais.

Diagnóstico derivado do código. Não foram medidas dimensões renderizadas nem tempos de usuários em navegador nesta etapa.

## Etapa 1 — Enquadrar o desktop e simplificar a estrutura

1. Criar um enquadramento específico do PDV com altura útil da janela, incluindo faixa de demonstração, cabeçalho e navegação. Usar grid/flex, `min-height: 0` e linhas automáticas/flexíveis na cadeia de contêineres; evitar descontos fixos de altura que só funcionem com um cabeçalho específico.
2. Aumentar a largura útil apenas da Frente de Caixa. Distribuir o catálogo em coluna flexível e o carrinho em uma coluna de aproximadamente 340–400 px, adaptada ao espaço disponível. Os outros módulos conservam seu enquadramento.
3. Reduzir espaços e cabeçalhos locais: identificação da área, resumo diário discreto e histórico; faixa compacta de caixa logo abaixo. Não repetir o nome do operador em vários blocos quando já estiver identificado no cabeçalho.
4. No caixa aberto, mostrar estado e responsável de forma compacta. Manter a ação principal de fechamento visível quando autorizada; movimentação e histórico ficam como ações secundárias claras. Com caixa fechado, destacar Abrir caixa sem bloquear operações que não dependam de dinheiro. Alertas de caixa antigo e restrições de responsável não podem ser cortados.
5. Catálogo: busca/filtros no topo, lista rolável no espaço restante. Carrinho: identificação no topo, itens roláveis, total e Pagamento em rodapé sempre acessível. Reservar espaço real para o rodapé, sem cobrir os últimos itens.
6. Remover o grupo duplicado de quantidade. Manter uma única implementação de aumentar, diminuir e editar quantidade em desktop e mobile.
7. Habilitar a composição fixa somente quando a largura e a altura útil comportarem a operação. Em janelas baixas, zoom ampliado ou aumento de fonte, permitir rolagem acessível. Não aplicar `overflow: hidden` global como correção e não exigir F11.

Resultado: a página não cresce conforme o catálogo ou o carrinho; apenas as listas extensas rolam.

## Etapa 2 — Compactar a seleção de bebidas no celular

1. Manter o título da navegação mobile como identificação principal da tela. Resumir caixa e acesso às ações secundárias em uma faixa curta; estatísticas do dia não ocupam um bloco permanente na seleção de produtos.
2. Unificar busca por nome e código em um campo com rótulo acessível. No envio por código exato, adicionar o produto como hoje; uma busca textual apenas filtra, sem incluir itens ambíguos automaticamente. Preservar foco por F2 e uso de leitor no desktop.
3. Categorias em uma faixa horizontal compacta, sem quebra em várias linhas. Não repetir a categoria em todos os cartões se ela já for informada no filtro.
4. Produtos em duas colunas nos telefones usuais, mostrando nome com até duas linhas e preço legível. Um toque adiciona uma unidade; não abrir confirmação por bebida. Quantidade já no carrinho pode aparecer como indicador discreto, com anúncio acessível da inclusão.
5. Usar uma única rolagem para navegar pelo catálogo no mobile, retirando o limite artificial de 45dvh que cria uma lista rolável dentro da página rolável. Buscar filtra sem perder o carrinho.
6. Barra inferior compacta com quantidade de itens, total e Revisar venda. Respeitar área segura e navegação inferior; não empilhar várias barras de ação.
7. Preservar alvos de toque de pelo menos 44 × 44 px para os controles pequenos, foco visível, leitura de nomes e contraste nos dois temas. Não depender de hover ou gesto oculto.

Resultado: a tela inicial prioriza bebidas e preço, com o carrinho sempre a um toque.

## Etapa 3 — Revisar e finalizar sem deslocar a página

1. No mobile, abrir o mesmo carrinho em painel de revisão apropriado à altura da janela, em vez de revelar um bloco distante e chamar `scrollIntoView`. A seleção de produtos e seus filtros permanecem no lugar ao voltar. Evitar manter duas instâncias de formulário ativas para um mesmo carrinho.
2. Cada item apresenta nome, total da linha e um único controle de quantidade. Desconto por item fica em ação secundária identificada; remover continua acessível. Informações de estoque desconhecido/insuficiente permanecem explícitas quando relevantes.
3. Seleção opcional de hóspede em uma linha compacta. Carregar essa seleção para a confirmação; quando já escolhida, apresentar o quarto/hóspede como resumo com Alterar, sem pedir a mesma seleção novamente. Se não houver hóspede, conservar Venda avulsa.
4. Mostrar total e pagamento em uma região sempre acessível. Desconto geral fechado quando zerado, aberto sob demanda; desconto aplicado permanece resumido com valor e efeito no total, mesmo com o editor recolhido.
5. Conservar uma confirmação final explícita para os dois destinos: Receber agora e Marcar na ficha. Não transformar a seleção de hóspede em autorização automática de dívida. Meios mistos, troco, descontos e falta de caixa mantêm as validações atuais.
6. Com dinheiro e caixa fechado, abrir o caixa a partir da própria confirmação, conservando itens, hóspede e pagamentos. Uma falha de rede ou conflito também conserva o carrinho e não confirma nem repete a entrega silenciosamente.
7. O teclado virtual não pode cobrir a ação final: campos e rodapé precisam continuar alcançáveis, com rolagem única no painel e comportamento adequado à janela reduzida. Evitar painéis de confirmação empilhados desnecessariamente e preservar o retorno correto.

Fluxos pretendidos:

- Venda avulsa: tocar bebidas → Revisar venda no mobile → Pagamento → confirmar recebimento. No desktop, carrinho e Pagamento já estão visíveis.
- Consumo na hospedagem: tocar bebidas → selecionar hóspede uma vez → Pagamento → Marcar na ficha → confirmar lançamento.
- Quantidade maior: permitir informar a quantidade diretamente, sem exigir muitos toques em +. Adicionar uma unidade continua sendo um toque.

Não criar recebimento rápido que pule a revisão financeira ou misture cobrança no balcão com dívida da hospedagem.

## Etapa 4 — Validação e entrega

### Dimensões e acessibilidade

- Full HD com navegador normal, escala do sistema e zoom em 100%: verificar a altura útil real, incluindo barras do navegador e faixa da demo. Cobrir viewports de 1920×900 e 1920×1080; não usar somente F11 como evidência.
- Desktop menor e escala do sistema de 125%: conferir adaptação da largura e altura disponíveis, inclusive 1536×760 e 1366×650. Rolagem de fallback é permitida quando necessária, mantendo todas as ações alcançáveis.
- Mobile: 360×800 e 390×844, retrato e paisagem, com teclado aberto e áreas seguras. Catálogo e revisão não devem exigir rolagem horizontal.
- Zoom de 200%, fonte ampliada, teclado, foco, leitor de tela, modo claro/escuro e movimento reduzido.

### Cenários

- Carrinho vazio, uma bebida e 30 linhas; catálogo pequeno e 100 produtos. Total e ação de pagamento não desaparecem conforme a lista cresce.
- Nomes longos, preços maiores, categorias extensas, hóspede com nome longo e diferentes conjuntos de permissões.
- Caixa aberto, fechado, de outro operador e aberto desde dia anterior, com e sem permissão para abrir/fechar.
- Quantidade direta, uma unidade por toque, remoção, desconto individual e geral, busca e código de barras.
- Venda imediata, pagamento misto, troco, lançamento na hospedagem, hóspede encerrado por outro usuário, conflito, reenvio e interrupção de rede: uma venda e uma baixa de estoque por confirmação válida.
- Trocar de módulo e voltar mantém o rascunho conforme as regras existentes. Voltar do carrinho preserva busca e posição do catálogo. Abrir recibo e histórico não esconde a possibilidade de retornar à venda.

### Critérios de aceite

- No Full HD padrão, `scrollHeight` da página não supera sua altura visível por causa do PDV. Produtos e itens extensos rolam só em suas listas; não há conteúdo cortado.
- No celular, não existem controles de quantidade duplicados, dois campos de busca empilhados ou categoria repetida em cada cartão. A ação de revisar fica acessível sem ir ao fim do catálogo.
- Não aumentar as confirmações do caminho comum. Medir toques, tempo e erros antes/depois com cenários equivalentes; não prometer redução percentual sem ensaio.
- Testes de interface e integridade apropriados passam, assim como tipos, lint, build operacional e exportação estática. Conferência visual real é necessária para atestar altura fixa e teclado; testes de componentes isolados não provam esses resultados.
- Fazer commits por etapa: enquadramento desktop; catálogo mobile; revisão/finalização; validações e documentação. Push e atualização da demo após a implementação e validação autorizadas.
