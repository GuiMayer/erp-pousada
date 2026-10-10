# Entrega da Sprint 3 — frente de caixa e financeiro

**Data:** 10/10/2026 · **Escopo:** pousada e bebidas. Implementação técnica; atualização da instalação e aceite pelo cliente são etapas separadas.

## Fluxos disponíveis

- **Frente de Caixa:** confirme a entrega recebendo no balcão ou lançando na hospedagem ativa. A venda conserva a origem e baixa o estoque uma vez. Cobrar o extrato depois não movimenta estoque novamente. Venda avulsa pode ser anônima.
- **Recebimento misto:** informe cada meio e seu valor. PIX e cartões usam uma conta ativa; dinheiro usa o turno aberto. Para uma conta de R$ 100, PIX R$ 40 e dinheiro R$ 70 geram R$ 40 na conta, R$ 60 no caixa e R$ 10 de troco. Excesso digital e troco sem dinheiro são recusados.
- **Hospedagem:** o extrato aceita pagamentos mistos, preserva os meios e aplica o recebimento primeiro às diárias, depois às bebidas. Crédito pessoal continua separado e não paga hospedagem de empresa.
- **Contas a receber:** receba parcialmente um título/parcela, mantendo o restante aberto. Em **Receber vários títulos juntos**, escolha os títulos, uma parcela por título quando houver parcelamento, e o valor de cada um. O total do pagamento corresponde à soma selecionada; não há uma entrada bancária duplicada por título.
- **Despesas:** pagamento parcial ou integral da parcela/título com vínculo ao lançamento financeiro. Um título já movimentado não pode ser editado ou excluído pelo cadastro para apagar seu histórico.
- **Turno de caixa:** abertura com responsável e fundo inicial; fechamento com contagem física e diferença. A contagem continua cega: o valor esperado aparece depois da confirmação. Suprimento e sangria exigem permissão, motivo e conta de origem/destino; são transferências, não receitas/despesas.
- **Conferência manual:** nos detalhes de um lançamento bancário, usuário autorizado pode marcar/desmarcar a conferência e registrar justificativa. Isso não altera saldo e não importa extratos. Origem, grupo de pagamento, distribuição por título/parcela e referência de estorno ficam visíveis no detalhe.
- **Estorno de venda:** reverte integralmente cada recebimento pelo meio e conta originais, com referência ao lançamento original. A devolução ao estoque exige seleção independente; bebida consumida não volta ao saldo físico. Correção de venda lançada em hospedagem ativa elimina sua cobrança sem inventar um recebimento. Valores recebidos ou estadias encerradas exigem conciliação antes de corrigir.
- **Cortesia autorizada:** total zero conserva entrega e baixa física, sem criar receita fictícia de valor zero.

## Estrutura e controles

| Registro | Responsabilidade |
| --- | --- |
| Venda e itens | Produto, preço calculado pelo servidor, quantidade, descontos, entrega e opção de cobrança. |
| Consumo da hospedagem | Referência à venda, quantidade e valor líquido histórico da linha; conserva centavos de descontos globais. |
| Lançamento financeiro | Uma entrada/saída efetiva por meio, com conta ou turno; origem e grupo comuns ao pagamento. |
| Alocação de pagamento | Valor aplicado a cada título/parcela, sem criar dinheiro novamente. |
| Aplicação à hospedagem | Distribui o mesmo lançamento entre diárias e bebidas; várias aplicações podem compartilhar o lançamento. |
| Estorno | Referência única ao recebimento original; devolução física separada. |
| Título/parcela | Valor original, valor recebido/pago e saldo restante. |

Reutiliza PostgreSQL, transações atômicas, isolamento serializável, controle de versão, idempotência, auditoria e permissões no servidor. Não depende de serviço externo novo. Nenhum saldo financeiro é confirmado somente pelo navegador. A versão selecionada no formulário impede a aplicação silenciosa sobre uma hospedagem ou título alterado por outro usuário; falhas preservam o formulário para revisão.

O cartão permanece um **registro simplificado na conta interna**. Saldo interno não significa repasse ou conciliação bancária. Taxas, agenda de recebíveis, importação de extrato e integração bancária continuam no backlog. Venda avulsa a prazo e estorno parcial permanecem condicionais à necessidade real, conforme o plano; não foram ativados nesta entrega.

Suprimento/sangria pressupõem transferência entre dinheiro físico e uma conta cadastrada. Aporte externo precisa primeiro ser documentado pela operação financeira adequada; o botão não cria dinheiro sem contrapartida.

## Permissões

`cash.move` autoriza sangria/suprimento; `transactions.check` autoriza conferência bancária. Administrador/supervisor recebem essas ações; os demais perfis precisam de concessão deliberada. Caixa pode consultar hospedagens e lançar bebidas nelas, preservando as restrições das demais ações de hospedagem. Receber em lote exige `accountsReceivable.receive`; pagar despesas exige `expenses.pay`. A API verifica novamente o usuário e a sessão, inclusive em confirmação repetida.

## Migração e dados anteriores

Migração: `20261010010000_sprint3_finance`. Adiciona valores pagos nas despesas/parcelas, origens e conferência nos lançamentos, alocações e vínculos venda–hospedagem. É transacional e não confirma entregas nem gera receitas retroativas.

Valores legados marcados integralmente pagos são preservados; valores de parcelas pagas compõem o total do título. Uma soma legada que exceda o título interrompe a migração e desfaz suas alterações: revisar os registros na cópia de homologação antes da atualização real. Não inferir recebimentos parciais antigos ausentes nem completar origens financeiras por aproximação.

Restrições financeiras impedem valores pagos negativos/acima do título e alocações não positivas. Os vínculos cíclicos venda–consumo e estorno–lançamento são conferidos ao final da transação de restauração. Exportações novas conservam alocações, pagamentos mistos, referências e instante da conferência; backups anteriores recebem valores padrão compatíveis com os fatos conhecidos.

Estornar uma venda antiga sem recebimentos íntegros identificáveis é bloqueado para conciliação. O sistema não escolhe arbitrariamente uma conta para devolver dinheiro.

## Validação e roteiro de aceite

Testes cobrem pagamento misto/troco, desconto acumulado, cobrança na hospedagem sem nova receita, estorno sem reposição automática, pagamento parcial, alocação em dois títulos, concorrência, saldo insuficiente, permissões, caixa cego e restauração. Há teste de migração com dados legados e rollback de inconsistência. A interface foi inspecionada a 390 px, com dados fictícios em prévia isolada; não houve gravação financeira nessa inspeção.

1. Abra caixa com fundo R$ 30 e confira o responsável.
2. Venda R$ 100, informando PIX R$ 40 e dinheiro R$ 70. Confira troco R$ 10 e entradas líquidas.
3. Lance uma bebida na hospedagem e confira a mesma origem no extrato, sem recebimento no PDV.
4. Receba o saldo por dois meios. Confirme que não ocorreu segunda baixa física.
5. Em dois títulos de R$ 600, aplique R$ 250 a cada um num PIX de R$ 500: saldo R$ 350 em cada título e somente uma entrada bancária.
6. Pague R$ 50 de uma parcela de R$ 200; confira R$ 150 em aberto e quite o restante.
7. Registre suprimento/sangria com conta e motivo; confira movimentos de transferência e ausência de nova receita.
8. Estorne uma venda sem marcar devolução física; estoque deve permanecer baixado. Confira meio/conta e referência do recebimento original.
9. Marque a conferência de um movimento bancário; saldo não muda.
10. Conte e feche o turno; confira esperado, contado e divergência. Repita uma confirmação e confira a ausência de efeito duplicado.

## Ativação pelo painel

O painel da área de trabalho continua sendo o caminho de uso. Com Docker funcionando, **Iniciar demonstração** reconstrói a versão e prepara o banco temporário com exemplos; acesso `teste` / `teste`. Para atualizar o sistema normal, faça backup, ensaie em cópia e siga o [guia de produção](PRODUCAO.md), reconstruindo a imagem e aplicando migrations antes de usar o botão de início da instalação existente.

Não foi alterado o banco operacional nem reiniciado WSL/Docker desta máquina durante esta sprint. Validação de PostgreSQL, backup e containers ocorre no ambiente isolado de integração. O modo sem banco conserva sua simulação anterior; os novos fluxos financeiros integrados exigem a demonstração com PostgreSQL ou a instalação normal atualizada.
