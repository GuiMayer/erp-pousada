# Primeira versão de teste — atendimento diário

Data: 11/10/2026. Complementa a [análise de fluxos](ANALISE_FLUXOS_E_USABILIDADE_DIARIA.md). O objetivo desta rodada é reduzir interrupções e proteger o atendimento, mantendo o estilo visual existente.

## O que mudou

| Fluxo | Comportamento para testar |
| --- | --- |
| Buscar pessoa | Nome, documento e telefone usam uma única busca; nomes com acento também são encontrados sem acento. |
| Interromper atendimento | Reserva, carrinho, compra, nova despesa, cobrança e contagem mantêm rascunho ao trocar de módulo dentro da mesma sessão. O mapa conserva filtros e data sem gerar aviso de trabalho pendente. |
| Entregar bebida | Informar quantidade antes do lançamento; envio pendente bloqueia novos toques. Falha conserva a identidade do pedido para repetir a mesma entrega sem duplicá-la. |
| Quarto com outro hóspede | A tela mantém a hospedagem original e bloqueia o lançamento quando percebe a troca. O servidor também exige essa identidade e recusa contexto encerrado ou divergente antes de baixar estoque. |
| Receber e concluir saída | Extrato continua aberto com saldo e versão retornados pelo servidor; saída fica junto do resumo. O recebimento e o check-out permanecem confirmações separadas. |
| Abrir/fechar caixa | Acesso direto no mapa e no PDV; pagamento em dinheiro oferece abertura no contexto quando autorizado. PIX não depende do caixa em dinheiro. |
| Salvar ocupantes | Extrato continua aberto com a versão atualizada, permitindo continuar o atendimento. |
| Trocar quarto | Lista considera capacidade e reservas que se sobrepõem ao período restante; validação final permanece no servidor. |
| Cobrar empresas | Busca por cliente, descrição, hóspede e identificador do quarto; uma única área de recebimento em lote. Vencimento hoje não aparece como atraso e a data não recua pela conversão de fuso. |
| Operação em andamento | Diálogos de entrada, compra e pagamento bloqueiam fechamento durante envio; dados submetidos ficam desabilitados. |

Rascunhos são temporários, em memória, e são removidos ao sair/trocar de usuário. Não sobrevivem à atualização da página ou ao fechamento do navegador: o aviso do navegador ajuda a evitar descarte acidental, mas não é um backup. Módulos operacionais deixam de ficar ativos quando ocultos; os demais módulos mantêm o comportamento anterior de conservação no telefone enquanto seus formulários não são migrados.

## Roteiro pelo painel existente

1. No painel de controle, use **Atualizar** a demonstração para reconstruir a imagem com o código novo. Iniciar com `-NoBuild` reutiliza a imagem anterior e não testa estas mudanças.
2. Abra a demonstração local ou seu link privado do Tailscale. Use a conta de demonstração `teste` com senha `teste`, salvo configuração local diferente.
3. Crie uma reserva parcialmente preenchida, mude para Estoque e retorne. Confira pessoa, período, ocupação e quartos escolhidos. Repita com um carrinho e com a contagem de estoque.
4. Em um quarto ocupado, informe três bebidas e confirme uma vez. Observe quantidade e total no extrato. Durante o envio, o botão deve ficar desabilitado.
5. Receba o saldo da hospedagem e confira que o extrato permanece aberto. Confirme a saída pelo botão próximo do saldo e confira quarto em limpeza. Caminho esperado: abrir extrato → receber → confirmar pagamento → confirmar check-out, quatro ações principais, além do preenchimento.
6. No PDV, escolha dinheiro com caixa fechado: abra o caixa pelo atalho e retorne ao mesmo carrinho. Faça outro teste com PIX, que não deve exigir abrir caixa.
7. Procure uma pessoa com acento e uma cobrança empresarial. Confira vencimentos de hoje e amanhã; hoje deve permanecer pendente, sem indicação prematura de atraso.
8. Teste com usuário sem autorização de caixa e com duas sessões: nenhuma ação deve ganhar permissão pelo atalho. Alteração concorrente continua exigindo revisão diante do conflito, sem sobrescrever silenciosamente.

A demonstração continua isolada da instalação operacional. Atualizar/reiniciar sua sessão descarta as alterações fictícias conforme o funcionamento dos scripts existentes. Esta implementação não iniciou Docker/WSL nem modificou dados operacionais.

## Cobertura e pendências

FL-01, FL-03, FL-06, FL-07, FL-08, FL-09 e FL-13 receberam as correções descritas acima. FL-02 e FL-14 receberam proteção nos fluxos desta rodada; a uniformização de todos os formulários continua pendente. FL-04 recebeu a correção de data, mas filtros dedicados Hoje/A vencer ainda podem melhorar a apresentação. FL-11 e FL-12 receberam data de negócio, indicação Agora e busca do mapa também no desktop; agenda mobile, filtros de reservas e revisão da identidade do check-in permanecem pendentes. Em FL-15, o texto obsoleto de cobrança foi corrigido; central diária por função e recuperação de sincronização ainda não foram implementadas.

Continuam fora desta primeira rodada: **entrada antecipada/atrasada vinculada à reserva (FL-05)**, cadastro de fornecedor/produto dentro da compra e revisão do padrão de embalagem (FL-10), além de uma operação transacional única de receber e encerrar. Não considerar a análise original inteira encerrada.

Validação local concluída: **375 testes aprovados em 54 arquivos**, `pnpm typecheck` e `pnpm lint` aprovados. A cobertura inclui busca, rascunho/desmontagem/troca de usuário, descarte, consumo/contexto/reenvio, pagamento, extrato e inventário, além da suíte existente. O novo cenário integrado de reutilização de quarto está preparado, mas os testes com PostgreSQL, a reconstrução da imagem, o ensaio de rede entre dispositivos e a homologação com o cliente ainda precisam ser executados. Testes de componentes com respostas simuladas não comprovam esses cenários de produção.

O contrato das operações de consumo agora exige `expectedStayId`; quitação de consumo também exige `recordVersion`. Atualize servidor e interface juntos e recarregue clientes antigos. Não há migração de banco nesta rodada.
