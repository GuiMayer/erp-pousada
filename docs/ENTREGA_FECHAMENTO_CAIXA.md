# Entrega — operação e fechamento do caixa

## Resultado

Caixa fechado bloqueia novas vendas e entregas de bebidas, inclusive PIX, cartões, pagamento misto, cortesia e ficha da hospedagem. A regra vale no PDV, no Consumo do Mapa, na API e no navegador de demonstração. Não cria bloqueio novo nos demais recebimentos da recepção: PIX/cartão continuam disponíveis; dinheiro mantém a exigência de gaveta aberta.

Fechar passa a ser **contar → conferir → confirmar**, em uma janela. O resumo do atendimento apresenta recebido, devolvido e líquido por meio. O detalhamento por origem fica recolhido no resumo, distinguindo vendas de bebidas, hospedagem/consumo da recepção, sinais/reservas e contas a receber sem repetir seus valores. A conferência física calcula somente dinheiro. Bebidas na ficha aparecem à parte. Rascunhos e permissões são preservados; os turnos anteriores conservam seus números.

Guia do cliente: [FLUXO_CAIXA.md](FLUXO_CAIXA.md). Decisões de arquitetura: [PLANO_FECHAMENTO_CAIXA.md](PLANO_FECHAMENTO_CAIXA.md).

## Arquitetura entregue

- Restauração insere hospedagens, vendas e depois as cobranças de consumo na ordem das dependências, em uma transação, mantendo as restrições do banco imediatas. O vínculo operacional dos itens manuais também é preservado.
- Reutiliza `CashClose`; inclui versão, resumo final JSON e relações de turno nas transações, vendas e entregas. Importação/exportação segue a ordem das dependências.
- `cashSessionId` permanece exclusivo da movimentação física. `operationalSessionId` identifica atendimento de qualquer meio. Não há associação de operações reais por coincidência de horário.
- As operações financeiras e de entrega tomam bloqueio curto na mesma linha de turno. Mantêm transações serializáveis, recibos de operação e retentativas limitadas, inclusive para conflitos do bloqueio reportados pelo adaptador PostgreSQL.
- Cada operação financeira relevante atualiza a versão. O fechamento compara a versão conferida, exige nova revisão se mudou e grava seu resumo na mesma transação.
- Venda na ficha e lançamento manual registram a entrega. Quitação não cria venda nem movimento de estoque. Na demo, recebimento e quitação da ficha são atômicos e repetíveis com a mesma confirmação.
- Recebimentos de cartão usam conta classificada como `cartao`; PIX usa banco. O controle é criado automaticamente quando necessário. Repasse bruto, líquido e taxa são registrados em uma operação idempotente e auditada, sem receita duplicada e sem turno operacional.
- Despesas por débito/crédito preservam a saída na conta bancária escolhida, sem consumir valores de clientes em Cartões a receber nem exigir abertura do turno de bebidas. Esse caminho tem testes de interface, demonstração e contrato do servidor sem banco externo.
- Controles de cartão ficam fora do saldo bancário base da previsão. Transferências comuns, suprimento, sangria e depósitos não aceitam o controle de cartão como banco.
- Não permite reclassificar conta com movimentações. Sem privilégio de leitura financeira, o seletor de repasse não expõe saldo.
- Demonstração com datas relativas, operações vinculadas aos seus exemplos de turno, resumos de turnos anteriores, saldo de cartões pendentes e repasse fictício com taxa. A atualização do identificador dos cenários renova exemplos descartáveis; não importa dados operacionais.

## Instalação

A migração foi aplicada somente no PostgreSQL de validação isolado, encerrado após os testes. Na instalação operacional, executar `pnpm exec prisma migrate deploy` no procedimento normal de atualização e reiniciar a versão da aplicação. Não apagar nem reinicializar o banco para instalar esta mudança.

O modo de demonstração do navegador não precisa de PostgreSQL. Recarregar após a atualização restaura o novo conjunto de exemplos. Não houve push ou publicação da demonstração nesta tarefa.

## Evidências

- Suíte completa de 513 testes unitários e de interface aprovada em 86 arquivos; cinco cenários adicionais de despesas foram validados depois, totalizando 518 cenários distintos. Os testes de despesas passaram em execução específica de 13 casos. Detalhamento por origem e fechamento com versão também passaram na validação específica após os últimos ajustes.
- 248 testes de integração PostgreSQL aprovados em 25 arquivos; suíte completa executada com papéis de banco e origem de teste configurados. Após o ajuste da restauração, 71 casos dos quatro arquivos de hospedagem, caixa e segurança passaram, incluindo o novo teste de ciclo completo do backup (249 cenários distintos validados).
- Tipos e lint sem avisos.
- Build operacional com adaptador PostgreSQL, sem acesso ao banco operacional.
- Build estático e verificação da exportação: recursos sob `/erp-pousada`, CSS compilado, nenhuma API exportada.
- Testes unitários e de interface: resumo sem dupla contagem, troco, bloqueio dos meios com caixa fechado, quantidade de entrega, estoque único, quitação fora do turno, cartão e repasse, reenvio e preservação da contagem após versão alterada.
- Integração PostgreSQL: atomicidade e autorização, concorrência de fechamento/venda, versão da prévia, devolução em outro turno, resumo congelado, replay de venda após fechamento, recebimentos da recepção fora de turno e repasse idempotente.
- Bases dos testes atualizadas para abrir explicitamente o turno quando fazem venda/entrega e conferir a versão antes de fechar. Cenários de saldo, permissões e falta de estoque permanecem exercitados.

## Limites deliberados

- Banco/cartão são controles gerenciais; não há conciliação automática, integração com adquirente ou emissão fiscal. O repasse é manual, com taxa informada pelo operador.
- Estorno usa a origem do recebimento e exige saldo. Quando esse saldo já tiver sido repassado, é necessário conciliar a devolução antes de confirmar. Não há um fluxo novo de ajuste de adquirente nesta entrega.
- A demonstração é individual por navegador. Operação compartilhada entre dispositivos utiliza PostgreSQL.
- A revisão visual posterior foi concluída nos contextos descritos em [VALIDACAO_NAVEGADOR_CAIXA.md](VALIDACAO_NAVEGADOR_CAIXA.md), com capturas locais. Celular físico, teclado virtual real, zoom nativo de 200% e dois dispositivos com PostgreSQL continuam pendentes.

## Roteiro de homologação visual

Cobertura realizada e limites: [relatório de validação no navegador](VALIDACAO_NAVEGADOR_CAIXA.md). O roteiro abaixo permanece como referência de homologação, não como lista integralmente pendente.

1. Desktop claro/escuro e celular: abrir caixa com fundo zero; confirmar mensagem, responsável e ações permitidas.
2. Com caixa fechado, entrar pelo consumo de um quarto: consultar saldo, tentar entregar bebida, abrir caixa pelo atalho e continuar sem perder quantidade/busca.
3. Vender em dinheiro com troco, PIX e cartão; lançar outra bebida na ficha. Conferir estoque, recebimentos e ficha.
4. Fechar: contar sem ver esperado, clicar Conferir, comparar quatro meios e linha da ficha. Testar diferença, justificativa, fundo zero e retirada sem depósito.
5. Em outro dispositivo, movimentar enquanto o primeiro confere: confirmar que ele precisa revisar de novo e mantém a contagem.
6. Consultar o comprovante; abrir outro turno, receber a ficha e confirmar que a entrega anterior e seu estoque não mudaram.
7. Registrar repasse e taxa no Financeiro; conferir baixa do cartão, entrada líquida no banco, despesa e ausência de uma segunda receita.
8. Repetir com atendente sem permissão de movimentação/fechamento alheio e com supervisor.
