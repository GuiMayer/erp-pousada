# Organização do Financeiro

Entrega de 22/10/2026. Cada módulo tem uma responsabilidade: Cadastros define pessoas e referências; Financeiro registra e acompanha dinheiro; Histórico consulta atendimentos concluídos; Relatórios analisa resultados e planejamento; Configurações controla regras e acessos.

## Onde encontrar cada função

| Destino | Conteúdo |
| --- | --- |
| Financeiro → A receber | Cobranças, vencimentos, recebimentos parciais ou totais, recebimento em lote quando disponível e receitas recorrentes. |
| Financeiro → A pagar | Despesas, parcelas, vencimentos, pagamentos e despesas recorrentes. |
| Financeiro → Movimentações | Entradas e saídas registradas, detalhes, conferência e estornos. O resumo usa os mesmos filtros da lista. |
| Financeiro → Caixa e contas | Abertura e fechamento de turno, sangrias e suprimentos, saldos internos e transferências. |
| Cadastros → Pessoas e empresas | Identidade, vínculo empresarial, ficha e perfil de hospedagem com estatísticas e crédito disponível. |
| Cadastros → Fornecedores | Cadastro e manutenção dos fornecedores. |
| Cadastros → Financeiros | Cadastro de contas bancárias, centros de custo e categorias financeiras. |
| Relatórios → Planejamento | Cadastro e manutenção de orçamentos. Indicadores continuam na área de relatórios. |
| Reservas → Mais ações | Desconto sobre a reserva selecionada, inclusive ao abrir um grupo de quartos. |
| Mapa → Hospedagem → Diárias acordadas | Desconto da hospedagem em andamento. Após aplicar, reabrir o extrato apresenta os valores e a versão atualizados. |

O cadastro da conta e a operação sobre seu saldo têm destinos distintos. No Financeiro, o cartão de saldo não repete ações de editar ou excluir conta. O perfil de hospedagem na ficha da pessoa apresenta estatísticas e crédito sem repetir seu cadastro de nome e CPF. Um usuário que só pode consultar perfis de hóspedes continua encontrando essa consulta em Cadastros, sem ganhar acesso ao cadastro completo de pessoas.

Atalhos de abrir caixa durante venda ou recebimento e de criar uma categoria enquanto se registra uma despesa permanecem disponíveis. Eles permitem continuar a tarefa atual; não recriam uma área completa de cadastros dentro do Financeiro.

## Permissões e integridade

- Não foram criadas permissões substitutas nem ampliados os perfis. A navegação usa as permissões já existentes dos recursos em seus novos destinos.
- Leitura de contas, transferências, centros de custo, orçamentos, recorrências e categorias continua independente. As ações de cadastro, edição e exclusão verificam suas respectivas permissões; transferir usa `bankAccounts.transfer`.
- Ler despesas não libera pagamento; ler orçamentos permite acessar Planejamento, sem liberar indicadores gerenciais. Consultar ou editar perfil de hóspede respeita `guests.read/create/edit/delete`.
- Desconto exige `reservations.discount` e mantém a operação existente no servidor e a aprovação quando necessária. A demonstração verifica o teto sobre o desconto acumulado. A interface impede reduzir o contratado abaixo do recebido. Erros mantêm o formulário aberto.
- Histórico mantém o extrato para consulta. Recebimentos e cobranças permanecem no Financeiro; atendimento corrente continua no Mapa.
- Nenhuma estrutura de banco, vínculo financeiro ou identificador foi convertido. Não há migração de dados para esta reorganização.

## Validação

- 473 testes de domínio e componentes aprovados em 70 arquivos. Os novos casos verificam quatro seções, ausência das cópias de cadastros, resumo por período, recursos separados, leitura sem escrita, permissões dos novos destinos, perfil vinculado e desconto da reserva selecionada.
- Verificação de tipos, análise estática e build de produção aprovados. Build executado em saída isolada; configurações geradas para a validação foram restauradas depois.
- Navegador: A receber, A pagar, Movimentações, Caixa e contas, Cadastros → Financeiros e Relatórios → Planejamento. Navegação mobile conferida em 390 × 844.
- APIs, transações e esquema de banco não foram alterados. Não foi necessária nova migração nem reinicialização de Docker/PostgreSQL nesta entrega; a suíte de integração de banco não foi reexecutada.
