# Operação e fechamento do caixa

O caixa é um turno único e compartilhado pela pousada. A Frente de Caixa concentra abertura, movimentação, fechamento e turnos anteriores. O Financeiro concentra contas, cobranças, despesas e repasses de cartão.

## Rotina do atendente

1. **Abrir caixa:** conferir o fundo em dinheiro e confirmar. Pode ser zero. O fundo anterior é sugerido; mudar o valor exige motivo. Abrir não gera receita.
2. **Atender:** vender bebidas ou lançar na ficha da hospedagem. Todos os meios, inclusive PIX, cartão e ficha, exigem caixa aberto. A entrega baixa o estoque uma vez; cobrar depois não baixa novamente.
3. **Movimentar**, quando necessário: registrar suprimento ou sangria com conta e motivo. São transferências, não vendas.
4. **Fechar caixa:** informar dinheiro contado e quanto deixar para o próximo turno. O esperado não aparece antes da contagem inicial. Deixar o fundo vazio mantém todo o dinheiro contado; zero significa retirar tudo.
5. **Conferir fechamento:** comparar o resumo do atendimento e a conferência do dinheiro. Recontar quando necessário. Diferença exige justificativa. Confirmar registra o fechamento.
6. **Turnos anteriores:** consultar o comprovante e, conforme permissão, registrar conferência de diferença. A conferência não reescreve o fechamento.

Se alguém movimentar o turno durante a revisão, o fechamento é recusado e pede uma nova conferência, preservando os valores digitados. Não há abertura automática, caixa por usuário nem encerramento automático à meia-noite.

## O que entra em cada resumo

**Resumo do atendimento:** Dinheiro, PIX, Débito e Crédito, cada um com Recebido, Devolvido e Líquido. Pagamento misto é dividido nas formas reais. Considera o valor aplicado: receber uma nota de R$ 100 por uma venda de R$ 60 conta R$ 60.

**Bebidas lançadas na hospedagem:** valor e quantidade de entregas/vendas separados, sem somar ao dinheiro recebido. A entrega pertence ao turno da venda; a quitação pertence ao turno do recebimento, ou fica fora de turno quando permitida.

**Conferência do dinheiro:** fundo inicial + entradas em espécie − saídas em espécie. PIX, cartões e ficha não alteram a gaveta. Devoluções em dinheiro já entram nas saídas; não são descontadas novamente.

A retirada fica sob responsabilidade de quem fecha. Marcar **Já depositei a retirada em uma conta** somente se o depósito realmente ocorreu. O depósito é transferência e não nova receita.

## Caixa fechado

- Bloqueia novas vendas/entregas de bebidas no PDV e no Consumo do Mapa, independentemente da cobrança. Estornos de vendas do PDV também exigem turno aberto e autorização.
- Permite consultar catálogo, carrinho, consumo existente e demais cadastros. A ficha mostra **Abrir caixa** quando há permissão; caso contrário orienta procurar alguém autorizado. Os rascunhos permanecem.
- Não cria bloqueio para recebimentos da recepção: diárias, sinais e contas a receber podem ser quitados por PIX/cartão com caixa fechado. Dinheiro continua exigindo caixa aberto.
- Quitar consumo anterior por PIX/cartão é recebimento de dívida, não entrega de bebida. Essa quitação também permanece disponível.
- Recebimentos eletrônicos feitos com caixa fechado aparecem como fora de turno no Financeiro. Não são anexados ao próximo turno.

## Cartões e banco

Esta separação vale para recebimentos de clientes. Despesas por débito/crédito continuam saindo da conta bancária escolhida. PIX confirmado entra na conta escolhida. Débito/crédito entram em uma conta do tipo **Cartões a receber**. Se não houver esse controle, ele é criado no primeiro recebimento de cartão, com saldo inicial zero. Esse saldo não é dinheiro disponível no banco nem entra no saldo bancário base da previsão.

Em **Financeiro → Contas bancárias → Registrar repasse do cartão**, escolher o controle de cartões e o banco, informar bruto e taxa e conferir o líquido. O sistema exige bruto = líquido + taxa, valida o saldo pendente e registra a baixa, o depósito líquido e a despesa na mesma operação. Reenvio não duplica o repasse.

Não há integração com maquininha ou extrato. Repasses são manuais. Um estorno pela conta original exige saldo nessa conta; se já houve repasse, a devolução requer conciliação financeira antes de confirmar. Não registrar outro recebimento do cliente para contornar saldo insuficiente.

## Permissões e atualização

Abertura, fechamento, fechamento de outro responsável, movimentação, conferência e estorno preservam suas permissões. O repasse usa **Transferir entre contas**. A consulta do estado do caixa não libera histórico ou saldos financeiros.

Aplicar a nova migração pelo procedimento normal de atualização:

```powershell
pnpm exec prisma migrate deploy
```

A migração `20261023000100_operational_cash_sessions` adiciona vínculos operacionais, versão e resumo final. `cashSessionId` continua exclusivo da gaveta; `operationalSessionId` identifica o atendimento. O fechamento grava um resumo imutável. Vendas, recebimentos e fechamento usam transação serializável, bloqueio curto do turno e repetição segura.

A demonstração do navegador utiliza a mesma regra e armazenamento local. Seus dados continuam separados por navegador; compartilhamento entre usuários exige PostgreSQL. Os exemplos são restaurados na próxima abertura após atualizar este conjunto de cenários.

## Validação desta entrega

Consulte [ENTREGA_FECHAMENTO_CAIXA.md](ENTREGA_FECHAMENTO_CAIXA.md) para evidências e roteiro visual. A migração foi executada somente no PostgreSQL isolado dos testes, sem alterar o banco operacional.


A revisão visual posterior de desktop e mobile está em [VALIDACAO_NAVEGADOR_CAIXA.md](VALIDACAO_NAVEGADOR_CAIXA.md), incluindo correções e limites da emulação.
