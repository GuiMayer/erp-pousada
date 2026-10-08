# Regras de negócio e operação

Este documento descreve os fluxos validados no servidor para o modo PostgreSQL. O modo de demonstração serve para apresentação; a operação real exige banco, autenticação e backups, conforme [PRODUCAO.md](PRODUCAO.md).

## Hospedagem e reservas

- Os períodos usam datas de calendário (`AAAA-MM-DD`), com entrada inclusiva e saída exclusiva. Duas reservas podem compartilhar o dia de saída/entrada. Datas com horário ou fuso não são aceitas nesses campos.
- Reservas confirmadas e hospedagens em andamento impedem sobreposição. Bloqueio sem prazo impede qualquer nova reserva; bloqueio com prazo inclui a data final. Um quarto ocupado hoje pode ser reservado para um período futuro livre.
- Reservas de grupo são gravadas em uma única transação: todos os quartos são reservados ou nenhum. Os identificadores são gerados no servidor.
- O check-in de uma reserva exige titular, período e valor confirmados. A hospedagem e os consumos são recebidos separadamente, com forma de pagamento e conta bancária quando aplicável. Pagamentos parciais da hospedagem são permitidos; recebimentos acima do saldo são recusados.
- O check-out exige hospedagem integralmente quitada e nenhum consumo pendente. Depois da saída, o quarto passa para limpeza; a liberação é uma operação própria.
- Cancelar uma reserva futura não altera o ocupante atual do quarto. No-show não pode ser registrado antes da data prevista de chegada.

## Cancelamento, multa e crédito

O supervisor define a multa e a destinação do saldo recebido:

1. **Estorno integral:** devolução de todo o recebido, sem multa.
2. **Multa:** retenção do valor definido e devolução da diferença.
3. **Crédito:** retenção da multa, se houver, e crédito da diferença no cadastro do hóspede.

A multa não pode ultrapassar o valor efetivamente recebido. Multa positiva e concessão de crédito exigem sessão de supervisor. Cancelamento pago com estorno exige supervisor ou aprovação temporária válida. Operador pode cancelar uma reserva sem recebimentos, sem multa e sem crédito.

Reembolso bancário utiliza a conta do recebimento original. Reembolso em dinheiro utiliza o caixa atualmente aberto. Um valor pago com crédito de hóspede volta para crédito quando devolvido; não gera dinheiro. Cada cancelamento ocorre uma única vez e mantém auditoria, multa e tratativa na reserva.

O crédito fica vinculado ao CPF e pode quitar outra hospedagem do mesmo titular. Seu uso reduz o saldo de crédito e aumenta a quitação da reserva sem gerar uma segunda receita de caixa. Reserva com pagamento não permite trocar o titular. Crédito não pode ser editado diretamente nem apagado pelo cadastro.

## Descontos e preços

- O teto de desconto considera o percentual efetivo acumulado, inclusive a combinação entre descontos de item e desconto global. Descontos sucessivos de reserva usam a base original; editar o valor não contorna a aprovação.
- Reduzir uma hospedagem abaixo do recebido exige conciliação prévia e é recusado pela edição comum.
- Valores são arredondados por linha antes da soma; o desconto global é arredondado a centavos. Relatórios de categorias e produtos distribuem o total líquido em centavos para reconciliar com a venda.
- Comandas preservam o preço dos itens já lançados quando o catálogo muda. Novos itens usam o preço atual. Edição, cancelamento e fechamento exigem a versão atual da comanda; o fechamento usa o desconto persistido.

## Financeiro e caixa

- Receber um título ou pagar uma despesa atualiza o título/parcela, o lançamento e o saldo na mesma transação. Reenvios não duplicam lançamentos. Parcela paga não pode ser recebida novamente.
- Títulos com pagamentos, mesmo parciais, não permitem edição ou exclusão pelo cadastro. Marcar um cadastro como pago diretamente é recusado.
- Dinheiro exige abertura de caixa em **Financeiro → Fechar turno**, com fundo informado na abertura. Há um caixa compartilhado aberto por vez. Receitas, despesas e estornos em dinheiro ficam vinculados a esse turno.
- O fechamento usa apenas os movimentos daquele turno, mesmo havendo vários turnos no mesmo dia. O fundo não pode ser redefinido ao fechar. Somente o responsável pela abertura ou um supervisor fecha o caixa.
- PIX, débito e crédito exigem conta bancária ativa. Com exatamente uma conta ativa, ela é usada por padrão; havendo várias, o usuário escolhe. Pagamentos e estornos de saída exigem saldo bancário suficiente.
- Transferências entre contas atualizam os dois saldos atomicamente e registram movimentos próprios, sem inflar receita ou despesa. Transferências registradas não são editáveis.
- O dia operacional dos lançamentos usa `America/Sao_Paulo`; datas de calendário de hospedagem permanecem sem conversão de fuso.

O financeiro apresentado é de caixa: crédito concedido/utilizado e transferências não representam novos recebimentos ou despesas. Não substitui escrituração contábil ou emissão fiscal. Pagamentos por cartão são registrados na conta escolhida no momento do recebimento; conciliação de taxas e repasses de adquirentes é feita fora deste fluxo.

## Estoque e produção

- Vendas e consumos baixam estoque e recusam saldo insuficiente, inclusive em operações concorrentes.
- Cancelamento financeiro de venda só repõe estoque quando **Devolução física** é selecionada. Produto consumido, perdido ou descartado não retorna automaticamente ao estoque.
- Produção converte `g ↔ kg`, `ml ↔ l` e aliases de unidade. Unidades incompatíveis são recusadas. A baixa respeita a precisão de três casas do estoque e calcula custo na unidade cadastrada.
- Produção registra consumo de ingredientes, rendimento e custo de cozinha. Não cria estoque de um produto acabado: para isso, seria necessário cadastrar e vincular um produto de saída à receita.

## Atualização de instalações existentes

Faça backup e aplique as migrações antes de iniciar a nova versão. A migração preserva reservas e lançamentos existentes, inicializa `paidValue` e crédito em zero e considera fechamentos antigos como históricos fechados.

Antes de operar, o supervisor deve conciliar reservas antigas com seus comprovantes, saldos bancários e créditos efetivamente concedidos. Não registre novamente um recebimento já existente para simular quitação: isso duplicaria a receita. A migração não presume que `totalValue` significa pagamento e não vincula automaticamente históricos ambíguos. Hospedagens antigas com recebimento anterior exigem ajuste supervisionado dos dados conciliados antes do check-out. Valide isso em uma cópia do banco e mantenha a evidência do ajuste.

Cadastre as contas bancárias com os saldos conciliados e abra o primeiro turno com o dinheiro físico disponível. Depois dessas definições, utilize os fluxos de pagamento e transferência; saldos não são editados diretamente.

## Validação

Os testes de integração exercitam PostgreSQL real, reversão completa em falhas, concorrência e reenvios. As regressões cobrem quitação, cancelamentos, multa/crédito, descontos cumulativos, grupos, bloqueios, versões de comanda, conversão de unidades, parcelas, caixa por turno e transferências. Os testes unitários cobrem datas, arredondamento e distribuição de receitas líquidas.
