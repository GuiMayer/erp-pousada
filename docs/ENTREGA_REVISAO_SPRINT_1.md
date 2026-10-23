# Entrega — sprint 1 da revisão de usabilidade

**Data:** 22/10/2026. **Base:** [plano de revisão em três sprints](PLANO_REVISAO_USABILIDADE_3_SPRINTS.md).

Implementação concluída com testes e conferência visual local. Esta é a sprint 1 da revisão de usabilidade, posterior às sprints funcionais 1–6. A homologação com o cliente não foi substituída por estes testes.

## Mapa e navegação

- Abas principais acima do resumo de quartos no desktop.
- Resumo sempre visível no Mapa, inclusive no mobile; ausente nos demais módulos.
- Removida a preferência `showRoomMetrics` e o respectivo controle de Aparência. Não foi criada conversão de dados: preferências desconhecidas simplesmente não fazem parte do contrato atual.
- O cabeçalho global conserva identificação da pousada, usuário, notificações e saída. Não contém indicadores de quartos.

## Catálogo único de bebidas

- Cadastros → Bebidas é o único local de manutenção do catálogo. Estoque mantém compras, lotes, inventário, movimentações e limites, sem outra cópia da edição do produto.
- Alertas de saldo levam às movimentações/saldos do produto; alertas de validade continuam levando ao lote correspondente.
- O escopo ativo exige categoria cadastrada da pousada. Categorias dos exemplos que não são de bebidas foram retiradas do escopo ativo usando suas identidades e a classificação armazenada, sem reconhecer produtos pelo texto dos nomes.
- O gerador da demonstração disponibiliza oito bebidas, com vendas, consumos e estoques correspondentes. O restaurante permanece arquivado e não teve código removido ou reativado.

## Valores e origens financeiras

- Reservas apresentam total contratado, recebido e saldo; o botão curto Receber possui contexto acessível e indicação do saldo.
- Valores da apresentação são calculados em centavos nos seletores `reservationAmounts` e `receivableAmounts`. Pagamentos e autorização continuam sob responsabilidade das operações existentes no servidor.
- A ficha do cliente passa a considerar recebimentos parciais, em vez de somar o valor original dos títulos como dívida ou contar como pago apenas o título totalmente quitado.
- Contas a receber distingue pendências a vencer, vencidas e recebimentos, sem contar um título vencido também no resumo a vencer. O título da janela de recebimento usa o mesmo saldo disponível para a confirmação, inclusive em parcela parcialmente recebida.
- A demonstração tem hospedagens empresariais encerradas com cobranças vinculadas por `sourceStayId`, descritas com reserva, hóspede e quarto. Essas cobranças não são criadas com números independentes das hospedagens ativas.
- Há exemplos de sinal, consumo ainda a receber, consumo quitado e dívida empresarial. Contas bancárias e turnos de caixa são relacionados aos movimentos correspondentes dos exemplos.
- Os exemplos continuam relativos ao início do servidor. A versão do cenário foi alterada para a nova modelagem dos exemplos; isso restaura somente a demonstração selecionada no navegador, sem tocar em PostgreSQL operacional.

## Relatórios com significado explícito

- Hospedagem é a primeira seção de indicadores da demonstração, com diárias acordadas e prestadas, ocupação, noites-quarto e diária média.
- A mesma função pura `buildLodgingReport` atende o cálculo do relatório conectado e os exemplos do navegador. Foram preservados os critérios de reconhecimento de noites, saída efetiva, alocação por quarto e denominador de ocupação.
- Bebidas mantém as análises de venda, agora identificadas como Vendas de bebidas. Recebimentos consulta movimentos financeiros efetivos. Planejamento continua sendo orçamento.
- A composição da cobrança de uma venda distribui pagamentos mistos, exclui troco e identifica cobrança na hospedagem. Valores marcados na ficha não viram dinheiro recebido por aparecerem no gráfico de vendas.
- Transferências, fundos e suprimentos não são incluídos em Recebimentos. Sinais e recebimentos de dívidas não elevam diárias prestadas ou ocupação.

## Formatação e auditoria

- Moedas, números e percentuais usam formatadores compartilhados pt-BR nas telas, recibos, mensagens financeiras e exportações alteradas. Cálculos, valores de campos numéricos e dados de API continuam numéricos; formatação não é utilizada para calcular saldos.
- CSVs de apresentação usam separador de ponto e vírgula e vírgula decimal; textos potencialmente interpretados como fórmulas são protegidos.
- Os emissores atuais de auditoria na interface e na demonstração informam operação e entidade explicitamente. O registrador do servidor exige esses campos no contrato de código. Não há interpretação do texto da ação para classificar uma entidade.
- Os exemplos de auditoria apontam para reservas realmente presentes no cenário e incluem os dados pertinentes. Não foram fabricados estados anteriores nem alterados registros de auditoria persistidos.

## Validação realizada

- **473 testes** unitários e de interface aprovados em **75 arquivos**.
- **105 testes de integração** aprovados em PostgreSQL isolado: hospedagem/financeiro, relatórios gerenciais, pagamentos e consumo, permissões, segurança operacional, auditoria e notificações.
- Verificação de tipos e lint sem avisos aprovados; build de produção concluído em diretório isolado.
- Conferência no navegador em 1366 × 768: ordem das abas e resumo no Mapa, ausência do resumo na Frente de Caixa, catálogo somente com bebidas, Estoque sem catálogo duplicado e indicadores iniciais de hospedagem. O tamanho original do navegador foi restaurado.
- O teste do recebimento empresarial confere a diminuição conjunta do título e da hospedagem, rejeição da versão repetida e manutenção do estoque. O teste de pagamentos mistos confere PIX 40 + dinheiro líquido 60 para total 100 e troco 10.
- A execução dos testes foi limitada a quatro workers. A espera de inicialização dos exemplos nos testes passou para três segundos; isso não muda espera, timeout ou regra de operação do aplicativo.
- Nenhuma migração nova foi necessária nesta sprint. O banco isolado foi desligado ao término. Não houve push ou deploy como parte desta entrega.

## Pendência de segurança identificada durante a compilação

A primeira tentativa de build foi interrompida por uma verificação de segurança do Next.js; a compilação seguinte concluiu. A auditoria de dependências de produção confirmou **seis avisos: três críticos, dois altos e um baixo**, nas versões instaladas de Next.js e DOMPurify. O sucesso do build não elimina esses avisos.

O registro consultado aponta correções a partir de Next.js 16.4.1 e DOMPurify 3.4.17. A atualização e sua validação precisam ser tratadas como tarefa de segurança própria antes da produção. Não foi feita uma avaliação de explorabilidade de cada aviso nesta revisão.

Fontes: [avisos de Next.js](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [aviso de DOMPurify](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), resultado de `pnpm audit --prod` em 22/10/2026.

## Continuidade

As sprints 2 e 3 permanecem no plano: padronização de cabeçalhos/sub-abas, contraste e geometria de gráficos, seletores de data, distribuição da ficha de consumo, busca/filtros de reservas, WhatsApp e medição operacional com o cliente. A remoção da opção de esconder o resumo do Mapa já está entregue e não depende dessas etapas.

## Atualização após a entrega

As dependências de produção vulneráveis foram atualizadas e a auditoria passou sem alertas: [registro de segurança](SEGURANCA_DEPENDENCIAS.md). A revisão de interface da [Sprint 2](ENTREGA_REVISAO_SPRINT_2.md) foi implementada; os itens da Sprint 3 permanecem planejados.
