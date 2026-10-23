# Plano de operação e fechamento do caixa

## Decisões confirmadas

- Caixa fechado bloqueia **todas as novas vendas e entregas de bebidas**, inclusive dinheiro, PIX, débito, crédito, pagamento misto e lançamento na ficha da hospedagem. A regra vale tanto no PDV quanto no Consumo aberto pelo Mapa.
- O usuário confirmou que **não deve haver um bloqueio novo dos demais recebimentos da recepção**. Diárias, sinais e contas a receber continuam aceitando PIX/cartão com caixa fechado. Dinheiro continua exigindo um caixa aberto, como já ocorre, para manter a conferência física consistente.
- Fazer ou editar uma reserva sem recebimento, consultar uma conta, cadastrar pessoas e executar outras tarefas sem venda de bebidas continuam disponíveis. Não condicionar o acesso ao sistema à abertura do caixa.
- Manter um único turno compartilhado da pousada, com responsável pela abertura/fechamento e registro de quem executou cada operação. Não criar um caixa por funcionário.
- Abrir com fundo zero é permitido. Não abrir automaticamente ao entrar no sistema e não encerrar automaticamente à meia-noite.

## O que muda conceitualmente

O turno identifica o atendimento e reúne suas operações. A gaveta representa somente o dinheiro físico. A interface continua usando o nome familiar **Caixa**, mas o fechamento separa **Resumo do atendimento** e **Conferência do dinheiro**.

Não misturar vendas com recebimentos: bebida lançada na ficha é uma venda/entrega sem entrada de dinheiro naquele momento. A quitação posterior pertence ao turno em que foi recebida, sem criar outra venda ou outra baixa de estoque.

## Diagnóstico da arquitetura atual

- `CashClose` já contém responsável, abertura, fechamento, fundo, valor contado, esperado, diferença e retirada. Não é necessário criar outro serviço ou outro sistema de turnos.
- `Transaction.cashSessionId` é atribuído ao dinheiro e utilizado na conta da gaveta, na previsão financeira e nos relatórios de caixa. Estender esse mesmo campo indiscriminadamente para PIX/cartão contaminaria cálculos existentes.
- `POSSale` não possui vínculo direto com o turno. As vendas a prazo na hospedagem não geram recebimento imediato; não podem depender de uma transação financeira para aparecer no resumo.
- As operações do servidor já usam transação serializável, recibos de operação e controle de repetição. A demonstração usa transação local e coordenação de comandos.
- Existem caminhos de consumo além da venda do PDV, incluindo `add-consumption` e os auxiliares da demonstração. O bloqueio não pode existir somente no botão Pagamento.
- Débito e crédito atualmente alteram a conta selecionada de maneira imediata. A interface informa que se trata de controle simplificado e que taxas/repasses não são conciliados automaticamente. Separar esse controle do saldo bancário disponível.

## Etapa 1 — Modelagem e contratos do turno

1. Reaproveitar `CashClose` como entidade do turno e acrescentar `recordVersion` e um resumo de fechamento estruturado, gravado ao encerrar. Um fechamento aberto não tem resumo final.
2. Acrescentar `operationalSessionId` com relação e índice em `POSSale` e nos movimentos financeiros incluídos no atendimento. Esse vínculo identifica o turno operacional para qualquer meio de pagamento.
3. Preservar `Transaction.cashSessionId` como vínculo exclusivo do dinheiro físico. Dinheiro de um atendimento terá os dois vínculos; PIX/cartão terão somente o operacional. Não alterar o significado do campo que já alimenta a conta da gaveta.
4. Registrar o turno a partir do estado validado pelo servidor, nunca aceitar do navegador um turno arbitrário. O cliente pode enviar a identificação/versão que estava revisando para detectar mudança de turno.
5. Recebimentos de hospedagem, sinais e títulos feitos enquanto houver turno aberto entram no resumo desse turno. PIX/cartão recebidos com caixa fechado ficam identificados como **recebimentos fora de turno** no Financeiro; não anexá-los ao próximo caixa aberto.
6. Movimentos bancários de administração e repasses de cartão não são vendas nem recebimentos de clientes do atendimento. Permanecem no Financeiro. Despesas em dinheiro, suprimentos e sangrias continuam afetando a gaveta, em grupos próprios.
7. Definir tipos/contratos compartilhados para resumo e agrupamentos entre demonstração e banco. Atualizar exemplos e criar migração nova com relações e índices. Não inferir vínculos por coincidência de datas nem reescrever migrações aplicadas; o app ainda não tem produção a converter.

## Etapa 2 — Bloquear as vendas com caixa fechado

1. Criar um único guard de turno aberto, utilizado pelos caminhos de venda e consumo de bebidas. Aplicar a verificação dentro da transação antes de estoque, cobrança, recebimento ou auditoria de sucesso.
2. Cobrir `sale`, lançamento do catálogo no Consumo, inclusão manual de bebida e os equivalentes da demonstração. Uma rota alternativa ou chamada direta à API não pode contornar o bloqueio. Não confundir consumo com cobrança de diária, encargo ou ajuste financeiro.
3. Mostrar **Caixa fechado — abra para vender ou lançar bebidas na hospedagem**, com Abrir caixa conforme permissão. Sem permissão, orientar procurar o responsável. Abrir deve ser uma ação explícita, conservando os rascunhos.
4. Permitir consultar catálogo, ficha e carrinho, mas não adicionar novas entregas nem confirmar venda com caixa fechado. Carrinho que já existia não é apagado. Ao abrir, o usuário continua a tarefa.
5. No Consumo do Mapa, permitir consultar e quitar o saldo existente pelas regras dos recebimentos; bloquear uma nova entrega de bebida até abrir o caixa. Quitar uma dívida anterior por PIX com caixa fechado não é uma nova venda.
6. Estornos de bebidas no PDV são movimentos do turno atual e exigem caixa aberto e as permissões atuais. Referenciar a venda original, preservando o turno antigo. Não estender automaticamente esse requisito a cancelamentos de reserva ou outras devoluções da recepção; continuam suas regras próprias, inclusive dinheiro exigir caixa.
7. Fazer venda, entrega e fechamento disputarem o mesmo registro do turno com bloqueio curto dentro da transação. Se a venda vencer, o fechamento a inclui; se o fechamento vencer, a venda falha sem efeitos. Manter Serializable, repetição segura e retentativas existentes; não criar fila ou servidor de eventos adicional.
8. Incrementar a versão do turno somente quando uma operação relevante for confirmada. Um reenvio já concluído devolve o resultado original e não entra em outro turno, mesmo se o caixa original já estiver fechado.

## Etapa 3 — Corrigir a apresentação e o destino dos cartões

1. Tratar PIX confirmado como recebimento na conta bancária escolhida. Tratar débito/crédito como valor bruto registrado em **Cartões a receber**, separado do banco disponível.
2. Reaproveitar o cadastro/infraestrutura de contas com uma classificação explícita de controle de cartões, apresentada de maneira simples. Impedir usar esse controle como conta de PIX e excluir seu saldo dos valores apresentados como dinheiro bancário disponível.
3. Oferecer no Financeiro uma operação manual **Registrar repasse do cartão**: controle de origem, conta bancária, valor bruto, taxa e valor líquido, com conferência `bruto = taxa + líquido`. Mostrar uma taxa zero quando não houver taxa, sem inventar percentuais.
4. Registrar a baixa do bruto, a entrada líquida no banco e a despesa da taxa na mesma transação, com referência, responsável e identificação de repetição. Validar saldo pendente e impedir duplicação por reenvio. Reaproveitar operações financeiras existentes; não exigir conciliação por transação da adquirente nesta etapa.
5. Repasse não é outra venda, não baixa estoque, não entra como outro recebimento de cliente no fechamento e não exige abertura do caixa operacional.
6. Não implementar integração com maquininha, importação de extratos, agenda automática de parcelas ou múltiplos serviços. Neste escopo, o controle é gerencial e o repasse é manual. Saldos bancários do app devem ser apresentados como **saldo registrado**, sem alegar conciliação externa automática.

## Etapa 4 — Resumo e fechamento simples

### Resumo do atendimento

Uma tabela com Dinheiro, PIX, Débito e Crédito. Colunas **Recebido**, **Devolvido** e **Líquido**. Pagamentos mistos são distribuídos entre suas linhas; não criar uma linha Misto que duplique os valores.

- Recebimentos são apurados pelos movimentos financeiros vinculados ao turno, contando cada movimento uma vez. Não somar também o total das vendas como se fosse outro recebimento.
- Exibir separado **Bebidas lançadas na hospedagem**, com valor e quantidade de vendas/entregas. Essa linha não entra no total recebido.
- Diferenciar a origem, por detalhamento sob demanda, entre bebidas, hospedagens, sinais e contas a receber. O resumo inicial não precisa de várias novas sub-abas.
- Usar os valores efetivamente aplicados: pagamento de R$ 60 com nota de R$ 100 contribui R$ 60 ao recebido; não acrescentar R$ 100 e descontar o mesmo troco novamente.
- Transferências, suprimentos, sangrias, fundo inicial e repasse de cartão não são receita de venda. Suas linhas pertencem à conferência física ou ao Financeiro.

### Conferência do dinheiro

Apresentar fundo inicial, entradas em espécie, saídas em espécie, esperado, contado, diferença, fundo a deixar e retirada. A conta continua exclusivamente:

`esperado = fundo inicial + entradas físicas − saídas físicas`

As entradas/saídas já incluem seus estornos e movimentos. Não descontar uma devolução de novo por também aparecer no resumo por meio de pagamento. PIX, cartões e lançamentos na hospedagem não entram nessa conta.

### Fluxo do atendente

1. **Abrir caixa:** conferir fundo inicial, que pode ser zero, e confirmar. Responsável fica identificado.
2. **Atender:** vender e lançar bebidas normalmente, com o estado aberto visível. Caixa antigo tem aviso e ação de fechamento; não criar outro turno silenciosamente.
3. **Fechar caixa:** uma única janela pede Dinheiro contado e Fundo para o próximo turno. Manter a contagem cega inicial: não mostrar o esperado antes de o atendente informar o contado.
4. **Conferir:** na mesma janela, mostrar os dois blocos de resumo, comparar o dinheiro e permitir recontar. Se houver diferença, exigir a justificativa já prevista; fechamento de outro responsável e conferência de diferença preservam as permissões atuais.
5. **Confirmar fechamento:** conferir a versão novamente e gravar um resumo imutável daquele turno. Se entrou venda/recebimento depois da prévia, informar que o caixa mudou, atualizar os valores e pedir revisão, conservando o que foi digitado. Não encerrar com um resumo desatualizado.
6. Mostrar comprovante e disponibilizar em Turnos anteriores. Novas vendas exigem outra abertura; consultas e os recebimentos externos permitidos continuam disponíveis.

Dinheiro retirado continua sob custódia de quem fechou. Somente marcar depósito quando ele tiver realmente sido realizado; retirada não deve aumentar o saldo do banco automaticamente.

### Exemplo para validar com o cliente

Fundo inicial de R$ 100; recebidos R$ 200 em dinheiro, R$ 300 em PIX e R$ 400 em cartão; bebidas de R$ 50 lançadas na hospedagem; sem outros movimentos:

- Resumo recebido: R$ 900, distribuídos pelas formas de pagamento.
- Lançado na hospedagem: R$ 50, separado dos recebimentos.
- Dinheiro esperado na gaveta: R$ 300.
- PIX registrado no banco: R$ 300; cartões a receber: R$ 400, ainda fora do saldo bancário disponível.

## Etapa 5 — Integridade, exemplos e homologação

- Todos os meios do PDV e o Consumo do Mapa devem falhar com caixa fechado, sem venda, cobrança, estoque, recebimento ou auditoria de sucesso parcial. Chamadas diretas e demonstração precisam da mesma regra.
- Recebimento de diária/sinal/título por PIX/cartão com caixa fechado continua permitido e fica fora do turno. Dinheiro continua bloqueado sem caixa, conforme a regra atual. Consultar ou quitar saldo anterior não equivale a entregar nova bebida.
- Conferir pagamento misto, troco, estorno em turno posterior, fundo zero, suprimento, sangria, despesa em dinheiro, retirada sem depósito e depósito confirmado.
- Entrega lançada na ficha no turno A e recebida no B aparece como entrega em A e recebimento em B: uma venda, um recebimento e uma baixa de estoque.
- Abrir e fechar simultaneamente em dois dispositivos; vender durante fechamento; nova venda entre prévia e confirmação; perder conexão após confirmar e reenviar depois do fechamento. Resultado sempre consistente e sem duplicação.
- Estorno posterior não altera o resumo congelado do turno original. Revisão de diferença registra nota/autoria, não reescreve os valores do fechamento.
- Resumos, permissões, comprovantes, relatórios e previsão financeira usam os vínculos corretos. O dinheiro não pode passar a incluir valores de PIX por uma consulta antiga que some tudo.
- Repasse de cartão com taxa mantém a igualdade entre bruto, líquido e despesa; não duplica recebimentos do cliente. Valores fora do turno permanecem visíveis no Financeiro, sem forçar conciliação pelo relógio.
- Exemplos relativos ao dia atual: caixa fechado, aberto com fundo zero, aberto com dinheiro, turno com meios mistos, ficha pendente, recebimentos fora do turno, cartão pendente e repasse efetuado. Atualizar exemplos do navegador e do Docker sem importar dados operacionais.
- Testes unitários dos cálculos, integração PostgreSQL de atomicidade/concorrência/repetição, testes dos fluxos de interface e builds operacional/estático. Homologação visual no desktop e celular com nomes longos e permissões de atendente/supervisor.

## Ordem dos commits na implementação

1. Modelagem, relações, contratos e exemplos básicos do turno.
2. Bloqueio de venda/consumo e proteção concorrente, incluindo demonstração e API.
3. Controle de cartões a receber e repasse manual.
4. Resumo, prévia, fechamento, comprovante e navegação compacta.
5. Regressão completa, exemplos finais, documentação e roteiro de homologação.

Implementação descrita em [ENTREGA_FECHAMENTO_CAIXA.md](ENTREGA_FECHAMENTO_CAIXA.md). Este documento preserva o plano e suas decisões. Não introduzir emissão fiscal, serviços externos ou conversão hipotética de dados de produção. A referência de desenho é separar resumo por meio de pagamento da contagem física, como no [fluxo de fechamento documentado pelo Odoo](https://github.com/odoo/documentation/blob/19.0/content/applications/sales/point_of_sale/use.rst#close-the-pos-register), adaptando a complexidade à pousada.
