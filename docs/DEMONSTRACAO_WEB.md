# Cenário de teste da demonstração web

O modo `NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage` carrega exemplos no navegador, sem PostgreSQL. A inicialização do servidor registra uma única referência temporal; `/api/demo/session` informa essa referência sem cache, exclusivamente nesse modo. O horário de São Paulo determina o dia dos exemplos.

## Cenários para testar

| Quando | Cenário |
| --- | --- |
| Hoje | Cinco quartos ocupados, incluindo saída atrasada; consumos e saldos; uma chegada com sinal; quartos livres, limpeza e manutenção |
| Amanhã | Chegadas nos quartos 102, 201 e 304, com reserva de grupo dos dois primeiros e sinal no último; hospedagens em andamento; quartos livres e bloqueados |
| Próximas duas semanas | Entradas, saídas e intervalos livres para testar disponibilidade, alterações e reservas |
| Histórico | Hospedagem encerrada e quitada, cancelamento com motivo e ausência |
| Gestão | Pessoas, empresa com vínculo, tarifas por ocupação, vendas, estoque, despesas e contas a receber |

Os registros de hospedagem, ocupantes, alocações, diárias, pagamentos e consumos são gerados juntos. Reservas ativas do mesmo quarto não se sobrepõem. A data de saída encerra a ocupação prevista; a disponibilidade operacional continua sujeita à saída e à limpeza efetivas.

## Ciclo de uso

1. Inicie o servidor com `npm run dev` ou `pnpm dev`.
2. Abra a página e entre com o usuário demonstrativo. O cenário é montado com base no início dessa execução do servidor.
3. Teste os fluxos. Recarregar a página ou sair e entrar preserva as alterações na mesma execução.
4. Para restaurar os exemplos, encerre e inicie novamente o servidor, depois atualize a página. As datas serão calculadas a partir do novo início.

Uma identificação do cenário é gravada junto aos dados de exemplo. Abas do mesmo navegador coordenam a inicialização pelo mesmo bloqueio usado pelos comandos demonstrativos. Falha ao obter a sessão não autoriza substituir os exemplos usando o relógio do navegador. O relógio real das operações continua funcionando: o cenário não congela a data corrente do sistema.

O armazenamento é independente por navegador e endereço. Isso serve para testar a interface; testes de sincronização entre dispositivos exigem o modo de banco compartilhado. A carga não é executada no adaptador `database` e não altera o banco operacional nem a demonstração Docker.

## Venda para hóspede no caixa

Selecione o hóspede no carrinho, se houver, e abra **Pagamento**. **Receber agora (não lançar na ficha)** registra o recebimento e não cria dívida no consumo. **Marcar na ficha de consumo** exige hospedagem ativa e permissão de lançamento; atualiza o extrato e o mapa, sem recebimento no caixa. A escolha do hóspede identifica a hospedagem por ID, sem interpretar o texto do quarto.

O mesmo formulário é usado na demonstração e no banco. Na demonstração, venda, estoque, cobrança e auditoria são preparados juntos antes de publicar o resultado. Repetir a confirmação preserva a venda original. O estorno de entrega ainda não recebida corrige a ficha sem inventar devolução de dinheiro; devolver estoque continua sendo uma escolha explícita. A hospedagem é conferida novamente pela versão selecionada para impedir lançamento após alteração ou encerramento.
