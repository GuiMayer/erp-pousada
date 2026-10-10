# Entrega da Sprint 2 — hospedagem e cobrança empresarial

**Data:** 10/10/2026 · **Escopo:** pousada e bebidas. Implementação técnica entregue; apresentação e aceite pelo cliente permanecem pendentes.

## Fluxo entregue

A conta agora pertence à hospedagem. O quarto é uma acomodação que pode mudar durante a estadia. Reservas continuam preservadas como origem; a saída encerra a hospedagem, sem eliminar sua conta ou atribuir sua dívida ao próximo ocupante.

- No mapa, **Hospedagem / extrato** e **Check-out** abrem o extrato da estadia atual.
- Em **Reservas → Hospedagens e cobranças**, busque por hóspede, empresa ou reserva e filtre hospedagens em andamento ou encerradas.
- O extrato apresenta diárias acordadas, bebidas, ajustes de preço, sinal, crédito aplicado, recebimentos e saldo. Pagamentos não apagam os itens anteriores. Descontos aparecem como ajustes já incluídos no valor líquido das diárias, sem segunda subtração.
- Registre individualmente os ocupantes. Uma pessoa cadastrada conserva sua identidade e nome oficiais; um acompanhante pode ser informado apenas pelo nome. A quantidade deve corresponder à ocupação contratada.
- A troca de quarto exige motivo e verifica disponibilidade, período e capacidade. Preserva conta e preço por padrão, registra as duas acomodações e deixa o quarto anterior em limpeza. Recalcular as noites restantes exige seleção explícita; noites anteriores mantêm seus preços. Redução não pode criar crédito indevido sobre valores já recebidos.
- A saída comum exige saldo quitado. Saída empresarial a prazo exige empresa ativa como pagadora, permissão específica, vencimento e confirmação. Gera uma única conta a receber pelo saldo; não registra dinheiro que ainda não entrou.
- Receba a dívida depois da saída pelo extrato ou por **Financeiro → Contas a receber**. Pagamento parcial mantém o restante em aberto; pagamento total quita o título. Títulos de hospedagem não podem ser alterados ou excluídos manualmente para contornar sua origem.

O vínculo atual entre pessoa e empresa serve como sugestão para novas operações. Alterar o empregador no cadastro não muda o pagador de hospedagens anteriores. Crédito pessoal não quita conta cujo pagador é outra pessoa ou uma empresa.

## Estrutura e consistência

| Origem | Relações e responsabilidade |
| --- | --- |
| Reserva | Identidade preservada, referência comum de grupo, quantidade e preços acordados. |
| Hospedagem | Uma por reserva iniciada; conserva pagador, estado, preço líquido e versão de edição. |
| Ocupantes | Pessoas identificadas por cadastro ou nome dentro da estadia. |
| Acomodações | Histórico de quarto e período, com motivo da troca. |
| Consumos | Produto por identidade, descrição e preço históricos, quantidade e correção de cobrança. |
| Ajustes | Valor e motivo do ajuste de diária, sem recomputar preços antigos pelo catálogo atual. |
| Recebimentos | Valor aplicado às diárias ou ao consumo, meio e ligação com lançamento financeiro quando conhecida. |
| Conta a receber | Origem única na hospedagem encerrada, valor original, recebido e vencimento. |

As operações PostgreSQL usam a transação serializável, identificação de reenvio, auditoria e autorização existentes. Edições do extrato usam sua versão: outra alteração exige atualizar o registro antes de confirmar. Duas operações concorrentes não podem receber o mesmo saldo ou criar uma segunda dívida. A restrição de hospedagem ativa por quarto também existe no banco.

O catálogo envia a identidade da bebida. O servidor usa seu nome e preço cadastrados e executa a baixa do estoque junto do lançamento. Corrigir uma cobrança mantém o histórico e **não devolve automaticamente uma bebida consumida ao estoque**. Restituição física é outra operação, a ser consolidada em S3/S4.

**Permissões:** ocupantes, troca de quarto e saída empresarial têm ações próprias. Recepção recebe acesso a ocupantes e troca; prazo empresarial permanece com supervisor/administrador ou usuário autorizado especificamente. Receber após saída exige também permissão de recebimento de contas. O servidor confere permissões novamente na operação.

## Migração e dados anteriores

Migration: `20261010000000_sprint2_stays`. É aditiva e transacional. Não apaga reservas, recebimentos ou movimentos antigos, nem baixa estoque novamente.

- Hospedagens antigas iniciadas/encerradas são reconstruídas a partir das reservas identificáveis.
- Quantidade de hóspedes e composição por noite desconhecidas continuam desconhecidas; o total acordado permanece.
- Consumo ainda disponível do quarto é associado somente à hospedagem ativa identificável. Produto ausente não é inferido pelo nome.
- Sinal anterior é conservado como aplicação ao saldo, sem gerar outra receita. Uma ligação financeira desconhecida não é inventada.
- Consumo já apagado por versões anteriores não pode ser reconstruído sem fonte histórica. Consumo sem hospedagem identificável fica preservado para conferência e impede nova entrada/troca que herdaria a conta.
- Duas reservas antigas simultaneamente iniciadas no mesmo quarto fazem a migration falhar e reverter integralmente. Resolver a duplicidade na cópia de homologação antes da atualização operacional.

Exportações novas incluem hospedagens e seus detalhes. A restauração conserva origens, descontos e saldos. Exportações completas anteriores, sem a coleção `stays`, também são aceitas: reconstrução limitada ao que o arquivo contém, sem nomear produtos por aproximação ou refazer estoque. Arquivos parciais continuam recusados. Backup PostgreSQL e restauração em ambiente separado continuam sendo o procedimento operacional.

## Como apresentar e atualizar

**Demonstração:** use o painel da área de trabalho. **Iniciar demonstração** reconstrói a versão, aplica as migrations no banco temporário e restaura os exemplos; mantém os acessos `teste` / `teste`. O Docker precisa estar funcionando. Não é necessário mudar para comandos de desenvolvimento para apresentar ao cliente.

**Sistema normal:** o botão **Iniciar** liga a instalação existente; não atualiza sua imagem. Antes da primeira execução desta sprint com dados reais, siga o [guia de produção](PRODUCAO.md): confira backup, ensaie em cópia e use `scripts/start-docker.ps1` para reconstruir/aplicar a atualização. Depois disso, o painel continua sendo o caminho de iniciar, encerrar, obter URL e copiar link. Não remova o volume do banco normal.

Nesta entrega não foi aplicada a migration ao banco operacional nem reconstruída a demonstração Docker em uso. A inspeção visual utilizou um servidor local separado, com exemplos no navegador; a validação PostgreSQL e Docker utiliza ambiente isolado no GitHub.

### Roteiro de aceite simples

1. Empresa como pagadora, dois hóspedes, duas noites a R$ 100 por pessoa: R$ 400.
2. Receber sinal de R$ 100 e lançar duas bebidas de R$ 12: extrato com saldo R$ 324.
3. Informar os dois ocupantes e trocar de quarto sem recalcular. Conferir mesma conta, histórico e quarto anterior em limpeza.
4. Supervisor confirma saída empresarial com vencimento. Conferir cobrança de R$ 324 e ausência de recebimento fictício.
5. Receber R$ 100 depois: saldo R$ 224, título ainda em aberto. Consultar o extrato encerrado.
6. Nova entrada no quarto não herda consumo ou dívida anteriores. Receber a cobrança antiga não limpa o consumo da nova hospedagem.
7. Usuário de recepção tenta saída com dívida: precisa de supervisor. Duas telas editam o mesmo extrato: a versão antiga é recusada e os dados do formulário permanecem visíveis.

## Validação e limites

Tipos, lint, 314 testes unitários e 123 testes de integração PostgreSQL aprovados. Novos testes cobrem saldo, cobrança única, recebimento parcial/concorrente, isolamento da próxima ocupação, transferência, ocupantes, crédito pessoal, ajuste e restauração. A migration tem ensaio de dados legados e reversão diante de duplicidade. A CI também verifica compilação, imagem/instalação Docker, painel Windows e backup/restauração; consulte o [PR da entrega](https://github.com/GuiMayer/erp-pousada/pull/7) para o resultado completo da revisão publicada.

Extrato e acesso pelo mapa foram inspecionados em viewport mobile, sem rolagem horizontal; check-in e campos principais também foram conferidos. Isso não substitui aceite em celular real e na máquina da pousada.

S3 continua responsável pela integração completa do PDV, pagamentos por vários meios e estornos; S4 por compras, lotes e validade; S5 por relatórios e homologação operacional integrada. Não há envio automático de cobrança ou funções fiscais. O módulo do restaurante permanece arquivado.
