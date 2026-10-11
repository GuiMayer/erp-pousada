# Fluxos diários e usabilidade da pousada

> Documento histórico do diagnóstico. A primeira implementação de teste e suas pendências estão em [Teste de usabilidade diária](TESTE_USABILIDADE_DIARIA.md).

**Data:** 11/10/2026. **Base examinada:** `e149e42`, após a Sprint 6. **Escopo:** aplicação web da pousada, bebidas, estoque e financeiro. Restaurante permanece fora da operação.

## Conclusão

Os ciclos principais estão implementados, mas a interface ainda exige que o atendente conheça a divisão interna dos módulos. Há defeitos reproduzidos de busca e perda de rascunho, além de riscos de contexto e datas. Não considero o fluxo pronto para aceite de usabilidade sem corrigir esses pontos.

A prioridade é preservar dados e identificar corretamente quem está sendo atendido. Depois, aproximar as ações da rotina: entradas, saídas, bebidas e limpeza. Não é necessário trocar o estilo visual nem construir outra arquitetura de ERP.

Esta revisão entrega diagnóstico e critérios para a próxima implementação. Não modifica regras, telas, banco ou serviços em execução.

## Método e limites

- Leitura das telas, componentes de navegação, operações no servidor, permissões e cenários das sprints.
- Execução de **46 testes existentes em nove arquivos**, todos aprovados: hospedagem, tarifas, sugestão de pagador, pagamentos, estoque, mobile e conflitos.
- Dois testes temporários de caracterização, aprovados: cliente desaparece ao buscar nome; conteúdo de aba sem `forceMount` perde estado local ao navegar. Eles confirmam defeitos atuais, não constituem critérios desejados. Foram removidos após a análise.
- Reprodução determinística do filtro da biblioteca `cmdk` e dos cálculos de data: nome/CPF contra UUID recebem pontuação zero; vencimento hoje aparece atrasado; às 21h30 em São Paulo a data UTC já é amanhã.
- Conferência dos testes de integração existentes como evidência de cobertura; **não foram reexecutados nesta revisão**. Não foi iniciado Docker/WSL nem alterado o banco operacional.

Não houve ensaio presencial com o cliente, medição de tempo no celular real ou execução de ponta a ponta no navegador nesta revisão. As contagens abaixo são caminhos derivados do código, não medições de usuários. A homologação continua necessária.

## Uso diário esperado

| Momento | Responsável | O que precisa resolver | Ponto de entrada recomendado |
| --- | --- | --- | --- |
| Início do turno | Recepção/caixa | Ver entradas e saídas de hoje, quartos para limpar, abrir caixa quando houver dinheiro | Mapa com resumo do dia e estado do caixa |
| Chegada com reserva | Recepção | Conferir hóspede, ocupação, pagador e preço já acordado; confirmar entrada | Reserva prevista ou quarto |
| Chegada sem reserva | Recepção | Escolher quarto, buscar/criar hóspede, informar saída e pessoas, conferir preço | Quarto disponível |
| Durante a estadia | Recepção/caixa | Entregar bebida e receber ou lançar na conta certa | Quarto para consumo; PDV para venda avulsa |
| Saída | Recepção | Conferir conta, receber saldo ou registrar prazo empresarial autorizado, enviar quarto para limpeza | Quarto ocupado |
| Limpeza concluída | Funcionário autorizado | Identificar quarto e liberá-lo | Filtro Limpeza no mapa |
| Fim do turno | Responsável pelo caixa | Contar dinheiro, fechar e conhecer eventual divergência | Estado do caixa, com acesso direto ao fechamento |
| Rotina administrativa | Dono/supervisor | Receber empresas, pagar fornecedores e acompanhar vencimentos | Financeiro com busca e origem da cobrança |
| Entrega do fornecedor | Responsável pelo estoque | Receber compra, conferir embalagem/validade e gerar obrigação | Estoque → Receber compra |
| Periodicamente | Dono/supervisor | Conferir estoque físico, perdas, preços, relatórios e backup | Gestão, fora do caminho do atendimento |

Essas funções representam responsabilidades; não exigem uma pessoa ou usuário diferente para cada linha. Para cinco funcionários, cada usuário deve receber somente os acessos efetivamente necessários. A configuração das permissões deve permitir, quando autorizado, recepção e venda de bebidas pelo mesmo usuário: o perfil padrão de recepção atualmente não inclui `pos.sell`.

### Como o programa funciona hoje

Reserva → check-in → hospedagem com conta própria → bebidas/recebimentos → check-out → limpeza → quarto disponível.

A empresa é o pagador quando combinado; o funcionário continua sendo o hóspede. A saída empresarial cria dívida pelo saldo, sem fingir recebimento. O lançamento de bebida baixa estoque na entrega, sem outra baixa ao pagar a conta. Esses princípios devem permanecer.

Cadastros e ajustes de tarifa são preparação e manutenção. Não devem ser uma etapa obrigatória a cada atendimento. O cadastro rápido já permite criar pessoa no contexto; sua busca precisa funcionar corretamente.

## Achados e prioridades

**P1:** corrigir antes do aceite de uso diário. **P2:** melhorar na próxima rodada de usabilidade. Reprodução e inferência são identificadas separadamente.

| ID | Prioridade | Problema e evidência | Consequência e correção proposta |
| --- | --- | --- | --- |
| FL-01 | P1 | **Reproduzido.** `CustomerCombobox` pré-filtra por nome/documento/telefone, mas `Command` faz outra filtragem por `customer.id`, sem palavras de busca. O cliente existente desaparece ao digitar seu nome. [Código](../components/customer-combobox.tsx#L217). | Pode levar a cadastro duplicado ou atendimento manual. Usar uma única filtragem, testar nome/CPF/CNPJ/telefone e manter cadastro rápido visível quando não houver resultado. |
| FL-02 | P1 | **Reproduzido no componente de abas; alcance confirmado no código.** `DashboardShell` conserva módulos visitados somente no telefone. No desktop, mudar de aba desmonta formulários/carrinho. A proteção de descarte de `DialogContent` também é limitada ao mobile. [Navegação](../components/dashboard-shell.tsx#L87), [diálogo](../components/ui/dialog.tsx). | Atendente interrompe reserva para ver estoque e perde trabalho. Guardar rascunho por tarefa no mesmo dispositivo/sessão, independente de breakpoint; proteger descarte e limpar ao sair da conta. Não manter todos os módulos ativos indiscriminadamente, pois efeitos e consumo de memória também importam. |
| FL-03 | P1 | **Risco inferido da operação, sem reprodução integrada nesta revisão.** Consumo direto envia quarto/item; o servidor encontra a hospedagem atualmente nesse quarto. Não recebe identidade da hospedagem que o atendente estava vendo. [Operação](../lib/server/operations.ts#L222). | Uma tela atrasada pode lançar na próxima hospedagem após saída, limpeza e nova entrada. Enviar `stayId` esperado e conferir vínculo/status no servidor; recusar mudança de contexto preservando a tentativa. Fazer o mesmo para quitação de consumo por quarto. Não basta mostrar o nome na interface. |
| FL-04 | P1 | **Reprodução determinística.** `isOverdue` compara vencimento sem hora com o instante atual; hoje já entra como vencido. A renderização com `new Date(ar.dueDate).toLocaleDateString` também pode mostrar a véspera em São Paulo. [Cobranças](../components/accounts-receivable-management.tsx#L199). | Cobrança prematura e dúvida sobre prazo. Usar data de negócio e separar Hoje/A vencer/Vencidas; testar a data exibida e o saldo restante de parcelas. |
| FL-05 | P1 | **Confirmado por leitura.** Entrada preenche automaticamente apenas reserva cuja chegada é hoje. O servidor também associa pela igualdade das datas e CPF; não recebe reserva escolhida. A lista de reservas não tem ação de check-in. [Modal](../components/checkin-modal.tsx#L65), [associação](../lib/server/operations.ts#L190). | Chegada atrasada/antecipada exige editar reserva e voltar ao mapa, com risco de alterar preço ou sinal sem clareza. Criar entrada a partir da reserva identificada; chegada fora da data abre revisão explícita de período/preço, preservando vínculo e pagamentos. Não assumir desconto ou extensão automática. |
| FL-06 | P2 | **Confirmado por leitura.** Receber no extrato chama `onClose`; confirmar saída fica abaixo de histórico e ocupantes. [Extrato](../components/stay-sheet.tsx#L61). | Pagar e sair exige reabrir o extrato e rolar novamente. Manter resumo/ações principais no início e continuar após recebimento. Evolução: ação Receber e encerrar com confirmação única e operação transacional própria. |
| FL-07 | P1 | **Risco inferido.** Cada toque de produto no consumo lança imediatamente uma unidade com novo ID; não há trava de envio nem revisão de quantidade. [Tela](../components/consumption-sheet.tsx#L77), [hook](../lib/hooks/useConsumption.ts). | Toque repetido durante demora pode cobrar duas bebidas. Reenvio idempotente não resolve gestos que criam IDs diferentes. Indicar envio e quantidade, permitir informar várias unidades e distinguir nova entrega de repetição pendente; correção não deve repor estoque de bebida consumida. |
| FL-08 | P2 | **Confirmado por leitura.** Abertura/fechamento está dentro de Financeiro → Fechar Turno; PDV começa em dinheiro e só recebe erro de caixa fechado ao confirmar. [Caixa](../components/cash-session-panel.tsx), [validação](../lib/server/business-finance.ts#L34). | Descobre pré-requisito no final e sai da venda para abrir caixa. Mostrar estado e abrir caixa no contexto, quando autorizado, preservando carrinho. PIX/cartão não devem exigir abertura de caixa em dinheiro. Rotular Turno de caixa em vez de Fechar Turno quando estiver fechado. |
| FL-09 | P2 | **Confirmado por leitura.** Existem **quatro instâncias** de `BatchReceiptsPanel` nas cobranças: três cartões e outra antes dos filtros. Falta busca textual na lista principal. [Instâncias](../components/accounts-receivable-management.tsx#L237). | Tela longa, seleções independentes e repetidas. Uma área de recebimento em lote, busca por pessoa/empresa/quarto/origem e seleção só dos títulos necessários. Não misturar pagadores silenciosamente. |
| FL-10 | P2 | **Confirmado por leitura.** Compras usa fornecedores/produtos já cadastrados sem criação no contexto; Estoque abre no Catálogo. `newLine()` pressupõe Fardo de 12. [Compra](../components/stock/purchase-receipt.tsx), [aba inicial](../components/stock/stock-tab.tsx#L43). | Compra interrompida por cadastro; risco de conversão incorreta para caixa de 6 ou unidade. Cadastro rápido autorizado, embalagem real com confirmação clara das unidades e atalho de recebimento. Não inventar validade, custo ou quantidade. |
| FL-11 | P2 | **Reprodução determinística e leitura.** Data inicial/Hoje no mapa usam UTC, diferente de `businessDay`. Selecionar data muda timeline; cartões/ações continuam mostrando estado atual. No mobile, a timeline do cartão é escondida. [Mapa](../components/room-grid.tsx#L45), [cartão](../components/room-card.tsx). | À noite a seleção pode iniciar em amanhã. O número de livres ao lado de uma data futura parece disponibilidade naquela data, mas conta o estado atual. Separar Agora de Disponibilidade no período; usar data de negócio e mostrar uma agenda útil no mobile. |
| FL-12 | P2 | **Confirmado por leitura.** Busca de quarto/hóspede existe só no mobile; reservas mostram lista inteira sem busca/período. Check-in apresenta combobox e CPF/nome editáveis simultaneamente, inclusive com reserva reconhecida. | Mais procura e risco de alterar identidade parcialmente. Busca também no desktop, filtros Hoje/Próximas/Em andamento, identidade selecionada com ação explícita Trocar hóspede e preço/pagador visíveis. |
| FL-13 | P2 | **Confirmado por leitura.** Salvar ocupantes também fecha o extrato; trocar quarto oferece todo destino disponível no estado atual, deixando período/capacidade para o erro do servidor. | Reabertura desnecessária e tentativa frustrada. Salvar sem fechar, filtrar destinos pelo período/capacidade e conservar validação autoritativa no servidor para concorrência. |
| FL-14 | P1 | **Confirmado por leitura.** Check-in permite fechar/Cancelar enquanto está enviando; campos de compras continuam editáveis durante envio. A proteção contra descarte não é uniforme em formulários/sheets. | Usuário pode abandonar uma ação ainda em execução ou editar valores que não correspondem ao pedido enviado. Congelar dados submetidos, impedir fechamento durante confirmação, exibir resultado e oferecer recuperação com rascunho na falha. |
| FL-15 | P2 | **Confirmado por leitura.** Erro geral de atualização orienta recarregar a página; navegação não apresenta um destino diário por função e Cadastros/Financeiro duplicam acessos a pessoas/fornecedores. Há texto dizendo que cobrança empresarial ainda entra na Sprint 2. | Recarregar pode perder trabalho; módulos demais exigem treinamento. Atualizar sem descartar rascunho, mostrar estado de sincronização, ações por função e uma origem canônica de cadastro; atalhos podem permanecer. Atualizar textos obsoletos. |

Os riscos FL-03/07/14 não significam que todas as ações duplicam ou ignoram concorrência. Várias operações já têm versão, transação e repetição segura. As lacunas estão no contexto/gesto e na continuidade entre telas.

## Cliques: cenário atual e metas

Contagem de **acionamentos de botões, links de navegação e seleção de pessoa**. Não inclui foco/digitação em campos, abrir calendário, escolher meios/contas em selects nativos, rolagem, login ou fechar comprovante. Por isso estes números não representam todos os toques físicos. Cenário parte do Mapa, usuário com acesso completo, um quarto/produto, sem erro ou aprovação excepcional. Outros perfis podem abrir diretamente o submódulo permitido e precisar de menos navegação.

| Tarefa | Caminho atual representativo | Atual | Meta e mudança |
| --- | --- | --- | --- |
| Entrada com reserva de hoje | Check-in do quarto → Confirmar | 2 | **2**; manter. Criar o mesmo atalho na reserva. |
| Entrada sem reserva, pessoa existente | Check-in → abrir busca → selecionar pessoa → Confirmar | 4, além dos campos | **3–4**, com busca confiável e campos essenciais. Não perseguir um clique a menos criando entrada automática. |
| Receber saldo total e encerrar pelo extrato | Check-out → Receber → Confirmar pagamento → Check-out novamente → Confirmar saída | 5 | **4** mantendo extrato aberto; **2** somente com Receber e encerrar integrado, revisão visível e comando atômico. |
| Encerrar conta já quitada | Check-out → Confirmar saída | 2 | **2**; preservar conferência. |
| Saída empresarial a prazo | Check-out → marcar confirmação → Encerrar com cobrança | 3, além de vencimento | **3**; autorização e prazo são decisões reais. |
| Uma bebida na conta do quarto | Consumo → produto | 2 | **2** com prevenção de repetição e feedback; quantidades maiores não devem exigir um toque por unidade. |
| Uma bebida avulsa em dinheiro, caixa aberto | Frente de Caixa → produto → Finalizar venda → Confirmar | 4 desktop; 5 mobile com Ver carrinho | **4/5** inicialmente. Comprovante exige mais um fechamento hoje. Dar continuidade automática ao balcão, com comprovante acessível. |
| Liberar quarto limpo | Liberar Quarto | 1 | **1**; não adicionar confirmação redundante. |
| Abrir/fechar caixa, perfil com todos os submódulos | Financeiro → Fechar Turno → confirmar | 3 desktop; 5 mobile via Mais e seletor de subaba | **2**: atalho Turno de caixa → confirmar. Contagem física continua obrigatória. |
| Receber compra, cadastros existentes | Estoque → Compras → Receber compra → Confirmar | 4 desktop, além do preenchimento | **2–3**: atalho Receber compra, ou abrir Estoque em visão operacional. |

Não criar um assistente de vários passos para tarefas que já cabem em um formulário. Não retirar revisão financeira, autorização empresarial, motivo de correção ou contagem cega para melhorar artificialmente a contagem.

## Casos de borda e critérios de aceite

| Situação | Estado verificado | Critério da próxima rodada |
| --- | --- | --- |
| Busca com acento, documento formatado, telefone e pessoa inativa | Busca por nome reproduzida com falha; normalização existe; inativos são filtrados | Pessoa ativa aparece pelos termos reais; inativa não causa tentativa interminável de duplicação; mostrar caminho autorizado para revisão. |
| Atendimento interrompido para ver outra aba | Rascunho perdido no desktop | Voltar mantém campos/carrinho. Mudança de breakpoint conserva tarefa. Logout troca de usuário limpa dados privados. |
| Outra pessoa paga ou sai enquanto extrato está aberto | Versão exigida nas ações de hospedagem; teste de preservação de ocupantes aprovado | Recusar dado antigo sem aplicar automaticamente preço/saldo; reabrir com valores atualizados e preservar edição conciliável. |
| Quarto muda de hóspede durante tela de consumo aberta | Identidade esperada ausente na operação por quarto | Tentativa do hóspede anterior jamais vai para o seguinte; recusar com mensagem contextual. |
| Duplo toque, falha de rede e resposta perdida | Idempotência já existe; consumo cria ID por toque; PDV tem ID da operação | Um reenvio conserva ID e efeito. Nova entrega precisa ser distinguível. Manter carrinho/rascunho e mostrar resultado recuperado. |
| PIX sem caixa aberto; dinheiro sem caixa; muitas contas | Servidor seleciona conta única ou exige escolha; dinheiro exige turno | Não bloquear PIX pelo caixa fechado. Dinheiro abre contexto de caixa e retorna à tarefa; conta não é escolhida silenciosamente quando há várias. |
| Pagamento misto e troco | Sete testes de pagamentos aprovados; cobertura integrada existente | Centavos reconciliados, troco somente dinheiro, resumo por meio/conta. |
| Saldo não quitado, empresa inativa ou sem permissão | UI e servidor restringem prazo; testes de interface aprovados | Saída comum bloqueada; prazo exige empresa/poder/vencimento/confirmação; não mascarar dívida como entrada de caixa. |
| Chegada antes/depois da reserva; saída prorrogada | Associação por datas limita entrada; edição de reserva existe | Fluxo pelo ID da reserva, prévia da mudança, tratamento explícito de sinal/noites/preço. Preservar controle de sobreposição. |
| Destino disponível agora, reservado amanhã ou pequeno | Servidor valida período/capacidade na troca | Lista oferece destinos elegíveis; corrida concorrente ainda é rejeitada pelo servidor. |
| Hóspede sem empresa, empresa troca ou pagador escolhido manualmente | Quatro testes de sugestão aprovados | Sugestão não substitui escolha manual nem pagador histórico. Identificar claramente quem ocupa e quem deve. |
| Bebida vencida, estoque físico mas indisponível e última unidade concorrente | Cenários de integração S4 existentes; não reexecutados aqui | Explicar quantidade utilizável e impedimento antes da entrega; duas sessões não vendem a última unidade duas vezes. |
| Compra com fardo diferente, validade ausente e falha de pagamento à vista | Conversão/validade/transação existentes; quatro testes de UI aprovados | Embalagem explícita; validade nunca inventada; falha preserva formulário e não deixa entrada/dívida parcialmente criada. |
| Hoje às 21h30, virada de dia e vencimento hoje | UTC/vencimento reproduzidos com divergência | Uma mesma data de negócio em mapa, reservas, cobranças e relatórios; hoje não é atraso. |
| Celular estreito e teclado aberto | Oito testes mobile aprovados; tela real pendente | Busca sem largura fixa de 400px excedendo viewport; confirmar/cancelar alcançáveis; pagamento, compra e ocupantes sem depender de rolagem excessiva. |
| Instalação vazia e usuário sem acesso | Mensagem sem módulos existe; tarifas/capacidade necessárias | Administrador vê preparação pendente de quartos, tarifas, bebidas/estoque e contas. Operador vê instrução e ação permitida, sem abrir tela inútil. |

## Ordem de melhoria sugerida

1. **Integridade no atendimento:** FL-01/02/03/04/07/14. Corrigir busca, conservar tarefa, fechar lacunas de contexto, datas e envio. Testes de regressão por cenário, com banco isolado para contexto da hospedagem.
2. **Recepção completa:** FL-05/06/11/12/13. Resumo do dia no mapa existente, entrada pela reserva, busca desktop/mobile, ações do extrato junto do saldo, continuidade após pagamento e ocupantes. Manter identidade histórica e preços deliberados.
3. **Caixa e cobranças:** FL-08/09/15. Estado do turno e abertura no contexto; um recebimento em lote e busca por empresa; revalidar meios, responsável e permissões.
4. **Compras simples:** FL-10. Cadastro rápido, embalagem real, prévia de quantidade/custo/dívida e rascunho protegido; controles de validade e estoque continuam no servidor.
5. **Homologação:** executar uma jornada inteira com recepção, caixa, estoque e supervisor, em computador e celular; medir tempo, toques físicos, rolagens, erros e pedidos de ajuda. Revalidar instalação/usuários reais sem usar exemplos no banco operacional.

Para Receber e encerrar, criar comando de aplicação específico com pagamento + fechamento na mesma transação, identidade/versão da hospedagem e chave estável de repetição. Não encadear duas chamadas na interface presumindo que ambas terão sucesso. Se houver saldo parcial, manter estadia aberta. A saída empresarial continua um caminho deliberado separado.

Rascunhos devem ser locais à tarefa/usuário e não apresentados como alterações já salvas no banco. Preservar somente o necessário e limpar após conclusão, descarte ou logout. Atalhos usam as mesmas operações, autorizações e auditoria; não criam regras paralelas no navegador.

### Jornada para o protótipo

Abrir turno → conferir chegada → entrar hóspede → entregar duas águas → receber diárias e bebidas → encerrar → liberar após limpeza → fechar turno.

Repetir com funcionário de empresa: selecionar empresa pagadora → sair com cobrança autorizada → receber parcialmente depois → conferir saldo restante. Interromper uma reserva para consultar estoque e voltar; simular toque repetido/rede perdida e outro usuário alterando a conta. Esses exemplos dizem mais ao cliente que demonstrar todas as abas.

### Referências de usabilidade

As recomendações de ações visíveis, linguagem da operação e feedback contextual seguem as [heurísticas do Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/) e sua discussão de [reconhecimento em interfaces](https://www.nngroup.com/articles/recognition-and-recall/). Aplicação ao ERP: mostrar hóspede, pagador, saldo e próxima ação no mesmo contexto.

A orientação de conservar dados quando há navegação entre etapas é compatível com o [guia de formulários do W3C/WAI](https://www.w3.org/WAI/tutorials/forms/multi-page/). Aplicação ao ERP: interrupções não devem obrigar a redigitar um atendimento. Essas fontes sustentam os princípios; os números de cliques e os achados foram derivados deste repositório.
