# Cartões dos quartos: ações contextuais

Data: 12/10/2026. Base analisada: `e047ee6`. Status: pesquisa e proposta de interface; o aplicativo ainda não foi alterado nesta entrega.

## Decisão

Manter os atalhos principais aprovados pelo usuário e reunir as funções adicionais num único **Mais ações**, com rótulo visível e lista contextual. O cartão mostra o resumo do quarto; tarefas completas abrem o atendimento da hospedagem no contexto escolhido. Adicionar funções futuras não deve acrescentar linhas de botões ao mapa.

O saldo fica visível como informação acionável: **Saldo total a receber · R$ … ›** abre o recebimento em um toque quando autorizado. O nome do hóspede abre o resumo da hospedagem, com indicação visual de interação. Esses acessos substituem os botões independentes de recebimento e extrato.

O menu abre a tarefa diretamente. Não deve exigir selecionar “Hospedagem”, abrir outra lista e então encontrar a ação.

## Pesquisa aplicada

- [Carbon — Menu buttons](https://www.carbondesignsystem.com/building-blocks/core/components/menu-buttons/guidelines): concentrar opções menos frequentes quando o espaço é limitado; ações de cartões e linhas podem usar menu de opções. Aplicação: preservar os atalhos diários e agrupar o restante.
- [PatternFly — Card](https://www.patternfly.org/components/card/design-guidelines/): separar cabeçalho, conteúdo e ações; usar apresentação compacta e acesso ao detalhe para aprofundar o resumo. Aplicação: três blocos no cartão e painel de atendimento para funções completas.
- [Carbon — Menu](https://www.carbondesignsystem.com/building-blocks/core/components/menu/guidelines): esconder ações que o usuário não pode executar por permissão; desabilitar ações temporariamente impossíveis quando existe uma condição compreensível. Aplicação: distinguir falta de autorização de indisponibilidade no contexto.
- [W3C — Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/): interação por teclado, estado de abertura e foco coerente. Aplicação: usar o menu acessível existente, com Enter/Espaço, setas e Escape.
- [W3C — Target Size, Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html): alvos amplos facilitam o toque. Adotar 44 × 44 px como objetivo do projeto no celular; esse tamanho corresponde ao critério aprimorado AAA, não ao mínimo AA de toda a WCAG.

A combinação de dois atalhos, saldo acionável e menu contextual é uma decisão deste projeto. Não é um limite universal imposto pelos design systems.

## Diagnóstico do cartão atual

`components/room-card.tsx` tem um grupo de ações conforme o estado, mas injeta `ReservationPaymentButton` e `StayButton` depois dele, em blocos próprios. Cada função ganha seu próprio espaço. O componente Card também aplica espaçamento entre filhos, e existe um espaçador flexível para empurrar a linha do tempo. O grid estica os cartões de uma mesma linha.

Na imagem enviada há quatro botões: check-out, consumo, recebimento e extrato. O problema é a hierarquia e o acúmulo de blocos, além do tamanho dos botões. Diminuir fontes ou preencher o vazio com mais controles não resolve o crescimento.

`StaySheet` já concentra extrato, recebimentos, ocupantes e troca de quarto. Entretanto, abrir sempre o painel completo obriga a procurar a tarefa numa página longa. Reutilizar essa estrutura com uma intenção de abertura evita duplicar as regras e melhora o acesso.

## Cartão proposto

```text
101 · CASAL                                      Atrasado
Hóspede Exemplo 1 ›                         Mais ações ▾
Saída: 12 de out. · Hoje
Consumo: R$ 10,00
Saldo total a receber                         R$ 210,00 ›

[                Check-out ] [                Consumo ]
```

Os valores são exemplos: R$ 200 de diárias e R$ 10 de bebidas, ambos em aberto. O total deve vir de `stayBalance` e do estado confirmado da conta; não somar novamente itens já incluídos nem ignorar recebimentos/créditos. Dados financeiros só aparecem se o usuário puder consultar a hospedagem. Se faltar autorização para receber, mostrar o valor sem transformá-lo em ação.

**Mais ações** do quarto ocupado:

1. Receber pagamento — somente com saldo positivo e autorização.
2. Ver hospedagem e extrato.
3. Prorrogar estadia — função futura, a implementar depois da reorganização.
4. Trocar de quarto.
5. Editar ocupantes.

Esse é o limite inicial do menu proposto, não uma autorização para incluir ações sem backend. Prorrogação não deve aparecer habilitada na interface operacional antes da implementação completa.

Manter uma ordem estável. Disponibilidade e permissões mudam os itens oferecidos; atraso não deve reorganizar os botões principais nem fazer uma ação trocar silenciosamente de lugar.

## Comportamento por estado

| Estado | Atalhos preservados | Conteúdo adicional |
| --- | --- | --- |
| Disponível | Check-in e Bloquear | Detalhes do quarto; não exibir funções de uma estadia inexistente |
| Ocupado | Check-out e Consumo | Extrato, recebimento, ocupantes, troca e futura prorrogação |
| Limpeza | Liberar quarto | Informação de limpeza; sem ações de hospedagem ativa |
| Bloqueado | Desbloquear quarto, preservando a revisão atual do bloqueio | Motivo, responsável e previsão |

O disparador **Mais ações** só existe quando houver alguma função adicional autorizada. Não mostrar menu vazio. Saldo zero vira **Hospedagem quitada**, sem ação de recebimento; atraso continua destacado mesmo se a conta estiver quitada.

Não transformar o cartão inteiro em botão: ele já contém outras ações. Usar gatilhos explícitos para o nome/resumo e saldo, com nomes acessíveis como “Abrir hospedagem do quarto 101” e “Receber pagamento do quarto 101”.

## Layout e resposta ao toque

- Estrutura única: cabeçalho, resumo e linha de ações. Eliminar os blocos independentes de recebimento/extrato e espaçadores que não forem necessários.
- Espaçamento compacto, explícito por bloco. Não aplicar `gap` indiscriminadamente a filhos que representam funções opcionais.
- Altura determinada pelo conteúdo; cartões alinhados pelo topo. Não reservar espaço vazio para ações ocultas ou para igualar cartões de estados distintos.
- Preservar a linha do tempo no computador e a apresentação compacta no celular.
- **Mais ações** com texto visível, sempre acessível ao toque; não depender de hover ou apenas de um ícone de três pontos.
- Menu flutuante junto ao disparador, renderizado fora do corte do cartão, com ajuste de posição e largura à tela. Abrir o menu não aumenta a altura do cartão nem move os outros quartos.
- No celular, itens com pelo menos 44 px de altura, sem submenus. A tarefa escolhida abre o atendimento em tela adequada à largura e ao teclado, conservando a opção de voltar.
- Nomes longos podem ocupar duas linhas sem deslocar o menu para fora da tela; mostrar os dados completos no atendimento.
- Animações breves e opcionais, respeitando redução de movimento. Sem novos serviços ou biblioteca visual.

## Arquitetura viável

1. Criar um catálogo pequeno de ações do quarto, com ID, rótulo, permissões, estados aplicáveis, disponibilidade e tarefa de destino.
2. Calcular os itens a partir do quarto, estadia ativa, saldo e permissões. Reutilizar as verificações existentes; o servidor permanece responsável pela autorização definitiva.
3. Extrair a apresentação das ações para um componente reutilizável, sem mudar os atalhos principais. Reutilizar `DropdownMenu`/Radix já instalado.
4. Permitir abrir o atendimento com intenção: `overview`, `payment`, `checkout`, `transfer` ou `occupants`. O menu abre a seção/formulário correspondente e posiciona o foco, sem um clique intermediário.
5. Recebimento direto pelo saldo e recebimento pelo menu usam o mesmo fluxo. Troca de quarto e ocupantes não ganham cópias de formulário com regras diferentes.
6. Fechar o menu antes de abrir o painel, manter somente uma tarefa ativa, conservar rascunho em falhas e bloquear cliques repetidos enquanto uma operação estiver pendente.
7. Prorrogação entra depois como nova ação e intenção `extend`; exige sua própria operação transacional de disponibilidade, preço, período, cobrança, versão e auditoria. Não improvisar edição da reserva após check-in.

Não criar motor genérico de plugins, sistema de prioridades automático ou personalização de atalhos por usuário nesta fase. O catálogo é pequeno, explícito e fácil de manter.

## Casos a conferir na implementação

- Apenas uma estadia ativa: usar sua identidade, não mapear várias linhas em botões. Inconsistência de dados pede revisão, sem escolher arbitrariamente qual conta cobrar.
- Quarto ocupado sem estadia moderna: conservar os caminhos legados compatíveis; não oferecer operações que exigem identidade de estadia até regularização.
- Mudança de status em outra sessão: revalidar o destino, carregar dados recentes e exigir revisão em conflito; não reaplicar silenciosamente a ação ao novo ocupante.
- Revogação de permissões: remover itens e bloquear novas operações, inclusive saldo clicável e acesso por link.
- Pagamento parcial: atualizar saldo sem fechar o atendimento desnecessariamente; operação confirmada deve produzir um único efeito.
- Check-out com saldo: conservar quitação obrigatória ou cobrança empresarial autorizada, conforme a regra já existente.
- Menu perto da borda, nomes extensos, somente um atalho autorizado, usuário sem leitura financeira e tela de 320/360/390 px.
- Teclado, Escape, retorno do foco, toque fora, tarefa aberta e saída com rascunho pendente.

## Ordem sugerida

1. Reorganizar o cartão e retirar os botões avulsos, preservando as funções existentes.
2. Centralizar as ações e abrir o atendimento diretamente na tarefa escolhida.
3. Validar os estados, permissões, saldo, teclado e mobile; testar os mesmos fluxos de pagamento e check-out.
4. Implementar a prorrogação dentro dessa estrutura, sem acrescentar outro botão ao mapa.

Critério principal: check-in, check-out, consumo, bloqueio e liberação continuam acessíveis em um toque; recebimento autorizado também mantém acesso em um toque pelo saldo. Extrato fica em um toque pelo hóspede. As demais funções usam menu → ação, sem uma segunda busca dentro do painel.
