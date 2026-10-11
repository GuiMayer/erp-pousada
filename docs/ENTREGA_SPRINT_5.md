# Sprint 5 — gestão, conferência e recuperação

**Entrega técnica:** 10/10/2026. **Homologação com o cliente e equipamento final:** pendente. A implementação não equivale a atestar produção, RPO/RTO ou disponibilidade da instalação do cliente.

## O que foi entregue

A aba Relatórios do banco conectado usa operações registradas no servidor. Cada consulta lê um retrato consistente em transação PostgreSQL `RepeatableRead`; não depende de somar listas parciais carregadas no navegador. Nenhuma alteração no esquema ou nova infraestrutura foi necessária.

| Relatório | O que mostra | Origem para conferir |
| --- | --- | --- |
| Hospedagem | Diárias acordadas e prestadas, noites-quarto, ocupação do catálogo atual e diária média por noite-quarto | Hospedagem e alocações |
| Bebidas | Venda avulsa líquida e consumo na hospedagem, sem somar outra vez o PDV lançado no extrato | Venda ou hospedagem |
| Compras e estoque | Compras recebidas, valor físico/utilizável atual, limites por bebida, validade por lote, consumo, restituição física, perda e diferença de inventário | Compra, lote, saldo e movimento |
| Fluxo e cobrança | Entradas/saídas realizadas, previsão por saldo e vencimento, pendências anteriores, dívida empresarial atual, contas e turnos de caixa | Lançamento, título/parcela, conta ou turno |
| Resultado gerencial | Prestação + bebidas − custo consumido líquido − perdas − despesas sem origem de compra; valores parciais/estimados identificados | Documentos e alocações acima |

Período de até 366 dias, a partir de 2020. Datas de eventos usam `America/Sao_Paulo`; vencimentos e noites são datas civis. Entradas inclusivas e saídas exclusivas. A consulta limita documentos/linhas a 50 mil e pede redução do período em vez de exportar um resultado truncado. A tela pagina o detalhamento em 40 registros.

Cada linha abre seu documento atual. Os valores do relatório seguem os critérios/período do retrato gerado, portanto uma correção posterior pode mudar uma nova consulta. Consultas de venda/consumo usam o status vigente, não um livro contábil histórico fechado.

## Critérios que evitam interpretações erradas

- **Prestação não é recebimento.** R$ 300 de hospedagem prestada + R$ 20 de bebida continuam R$ 320 de atividade, mesmo que uma dívida antiga de R$ 50 seja recebida. O fluxo financeiro registra os R$ 50 separadamente.
- **Noite prestada:** noite encerrada na data de negócio, limitada pela saída planejada e efetiva registrada. Noite iniciada hoje ainda não é prestação encerrada. Reserva futura não é ocupação realizada.
- **Ocupação:** quartos do catálogo atual × dias encerrados do período. O denominador não deduz bloqueios históricos sem uma série completa. Troca de quarto respeita alocação sem duplicar a noite.
- **Preço legado:** quando falta distribuição válida por noite, o total acordado é rateado em centavos e sinalizado como estimado. Não se inventa uma tarifa histórica.
- **Bebidas:** PDV a conta da hospedagem aparece somente no extrato. Consumo antigo sem produto e venda sem custo completo rastreável são identificados; não se presume custo zero conhecido.
- **Estoque:** valor vem do saldo monetário real do lote. Custo de consumo/perda vem das alocações em centavos. Devolução física de cliente restitui o custo no dia do movimento; estorno sem retorno físico não recria mercadoria nem custo.
- **Compra não é despesa consumida.** Receber 24 unidades por R$ 120 aumenta estoque e obrigação. Vender uma unidade de custo R$ 5 e perder outra de R$ 5 deixa R$ 110 no estoque. A conta a pagar da compra não é descontada novamente do resultado.
- **Despesas:** títulos sem origem de compra usam vencimento como aproximação de competência. Despesas antigas que eram mercadoria sem vínculo exigem revisão. Depreciação e obrigações não registradas não são inferidas.
- **Inventário:** diferenças ficam separadas e exigem investigação de causa; não são classificadas automaticamente como lucro/prejuízo.
- **Fluxo:** transferência entre contas e sangria/suprimento não geram resultado nem fluxo externo líquido. Uso/concessão de crédito sem dinheiro não é recebimento. Reembolso de fornecedor pode ser entrada financeira, mas não é venda.
- **Previsão:** saldo pendente atual por vencimento, contando parcelas em lugar do título. Não reconstrói o que era previsto antes de pagamentos antigos. Contas, lotes e dívida são posições atuais, mesmo quando o filtro de atividade é histórico.
- **Cartão:** saldo registrado continua interno; não há confirmação automática de repasse, agenda de taxa ou conciliação bancária. Resultado gerencial não é demonstração contábil ou fiscal.

## Acesso e exportação

Permissões novas: **Consultar relatórios gerenciais** e **Exportar relatórios gerenciais**. Administrador e supervisor herdam essas permissões; os outros perfis precisam de concessão explícita. Cada seção exige também as leituras das coleções que utiliza. Conceder somente relatórios não libera dados financeiros, hospedagens ou custos que a pessoa não podia ler.

CSV e JSON são recalculados no servidor, conferem todos os acessos e registram seção, período, formato e quantidade de linhas na auditoria. Incluem critérios, avisos, totais e origem. CSV protege texto contra fórmulas de planilha; valores numéricos conservam seus sinais. A exportação inclui todo o período, não apenas a página visível.

O modo antigo de exemplos em localStorage conserva a visualização anterior para compatibilidade; os relatórios S5 exigem banco conectado, inclusive na demonstração temporária.

## Recuperação verificável

O painel existente continua oferecendo pasta de segunda cópia, backup agora, diagnóstico e estados. Agendamento e retenção continuam configurados no serviço de backup; confira seus marcadores e a sincronização da pasta externa. Tailscale permanece uma opção externa do operador.

A validação isolada compara contagens e impressões digitais de **todas as tabelas públicas** antes/depois do restore: inclui usuários, exceções de permissão, créditos, preços, compras, alocações, movimentos e origens, sem imprimir dados pessoais ou credenciais. Além dessa igualdade, verifica saldos de bebidas x lotes, compra x obrigação/abatimentos, limites de liquidação, valores de lotes, hospedagem x reserva e estorno x origem.

No CI, gerar/resetar o banco `postgres-demo/pousada_demo` também precisa conservar o manifesto integral do banco de teste operacional independente. O guard de demonstração mantém seu destino exclusivo.

Para ensaiar um backup real com o motor Docker já funcionando, use:

```powershell
.\scripts\test-recovery.ps1 -BackupFile "C:\Backups\pousada_arquivo.dump"
```

O script usa o motor configurado para o projeto (Docker Desktop ou Debian/WSL), cria exclusivamente um container `erp-recovery-<identificador>` com PostgreSQL 16, sem portas, rede ou volumes operacionais, limitado a 256 MB/0,5 CPU. Restaura nesse banco descartável, executa as verificações, salva manifesto em `.local/recovery` e remove seu próprio container após sucesso/falha. Nenhuma restauração é feita no banco normal. Um manifesto isolado documenta a cópia; comparar com o banco atual exige uma captura de referência do mesmo momento, sem novas escritas.

Esse ensaio comprova integridade dos dados copiados. Não recria a instalação, as credenciais do sistema operacional nem as contas PostgreSQL restritas da produção; use o procedimento de provisionamento/recuperação do [guia de operação](INSTALACAO_POUSADA.md). Backup portátil JSON conserva dados operacionais, mas não substitui o backup PostgreSQL para recuperar instalação e acessos.

## Roteiro de homologação — aproximadamente cinco funcionários

1. Faça backup e confira uma cópia fora da máquina. Na demonstração, encerre e use **Iniciar demonstração** no painel para reconstruir a versão. Acesse `teste`/`teste` e consulte um período que inclua os exemplos.
2. No equipamento final, execute o roteiro S1–S4: pessoa/empresa, preço por ocupação, reserva/entrada/troca/saída empresarial, consumo/PDV, pagamento misto, devolução, compra/fardo, perda e inventário por corte. Compare cada total ao documento aberto no relatório.
3. Com cinco sessões de usuários distintos, registre vendas/consumos simultâneos, consulte relatórios, tente alterar a mesma versão e confira mensagens de conflito. Não recadastre um lançamento após resposta incerta: reutilize seu fluxo de confirmação/reenvio e confira a origem.
4. Teste T03/T04/T05 no celular real, teclado/foco, perda de rede e rascunhos, notificações e auditoria. A revisão automatizada e visual da interface não substitui esse ciclo real.
5. Cronometre confirmações usuais com volume representativo; registre mediana, **percentil 95**, erros e conflitos. A meta proposta é até **2 s no p95** para cinco usuários. O ensaio de CI usa cinco identidades, 30 confirmações concorrentes e cinco consultas; mede tempos e reconcilia saldos, mas seu equipamento/volume não representam a máquina do cliente.
6. Faça o ensaio isolado do `.dump`. Confirme créditos, títulos, origens e permissões, inicialização após reinício e os backups agendados. Meça recuperação da instalação completa. **RPO 24 h/RTO 4 h** são propostas a aceitar e medir, não metas homologadas.

## Evidências e pendências

Testes de cálculo/data/CSV, interface/acessos/falhas, API autenticada/exportação auditada, PostgreSQL, custo por lote, prestação x recebimento, cinco usuários, restauração e isolamento de demonstração. Tipos, lint, build, imagem Docker e painel Windows são verificados pelo CI.

O [ensaio automatizado de referência](https://github.com/GuiMayer/erp-pousada/actions/runs/38096804285) passou com **342 testes unitários e 169 de integração**, além dos controles de recuperação, demonstração e painel Windows. Na simulação isolada de cinco usuários/30 confirmações, o p95 foi 401 ms para operações e 34 ms para consultas, com cinco reenvios por contenção e saldos reconciliados. Esses números descrevem somente esse ensaio de CI, não a capacidade da máquina da pousada. A versão final também deve passar pelos checks obrigatórios do PR.

Entrega técnica S5 não encerra a homologação comercial. Pendentes: ativar versão com backup prévio, executar o roteiro com o cliente, medir equipamento final, confirmar saldos legados e aceitar regras/limites. Evoluções de cartão, importação bancária, recorrências, fiscal e restaurante não foram incluídas nesta sprint.
