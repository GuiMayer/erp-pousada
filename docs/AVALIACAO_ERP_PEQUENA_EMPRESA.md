# Cobertura funcional para uma pequena empresa e pousada

Revisão: 8 de outubro de 2026, sobre o código local após a migração para Debian WSL.

Esta avaliação é um registro histórico anterior à retirada do restaurante. O escopo ativo e as próximas sprints estão em [Requisitos e modelagem da pousada](REQUISITOS_E_MODELAGEM_ERP.md).

## Conclusão

O projeto já reúne um núcleo operacional de ERP especializado em pousada com restaurante: reservas, atendimento, vendas, estoque, financeiro básico e controle de acesso. Ainda não cobre integralmente o ciclo administrativo de uma pequena empresa, principalmente compras integradas, conciliação, liquidação de cartões, projeção financeira e rastreabilidade fiscal/contábil.

Esta revisão verifica telas, modelos, serviços e operações no servidor. Não é uma nova homologação completa dos fluxos nem comprovação de conformidade fiscal. A existência de uma tela, cadastro ou tabela não foi considerada suficiente para classificar uma automação como implementada.

Não há uma lista universal de funcionalidades mínimas aplicável a toda pequena empresa. O referencial adotado é gerir clientes/fornecedores, vendas e compras, estoque quando aplicável, contas a pagar/receber, caixa/bancos, indicadores, documentação da operação, acessos e recuperação dos dados. Para a pousada, somam-se hospedagem, consumo e rotina dos quartos.

## Comparação com o núcleo mínimo

| Área | Cobertura encontrada | Avaliação e lacuna |
| --- | --- | --- |
| Cadastros | Clientes, fornecedores, hóspedes, produtos, categorias, quartos, mesas, usuários e contas bancárias | Implementado para a operação atual. |
| Vendas e serviços | Frente de caixa, itens, descontos, formas de pagamento, histórico e cancelamento/estorno | Implementado no servidor; registrar PIX/cartão não executa nem confirma a transação em uma instituição financeira. |
| Estoque | Entradas, saídas, ajustes, perdas, mínimo/máximo, custo médio e baixa por vendas/consumos | Núcleo implementado; não há ciclo de compras integrado nem gestão de saldo por lote/validade. Validade na movimentação é metadado, não rastreamento completo de lotes. |
| Contas a pagar | Despesas, fornecedores, vencimentos, parcelas e pagamento vinculado a caixa/conta | Implementado para lançamentos manuais; não nasce de um recebimento de compra integrado. |
| Contas a receber | Clientes, títulos, parcelas e recebimentos; pagamentos de hospedagem e crédito do hóspede | Implementado para os fluxos existentes; recebíveis de adquirentes/cartões não são controlados como agenda de repasses. |
| Caixa | Abertura com fundo, vínculo dos movimentos, fechamento físico e divergência por turno | Implementado. Há um caixa compartilhado aberto por vez; caixas independentes simultâneos são uma necessidade condicional. |
| Bancos | Contas, saldos e transferências atômicas | Parcial: não há importação de extratos nem conferência dos movimentos com o banco. Saldo interno não equivale a saldo conciliado. |
| Compras | Fornecedor e entrada de estoque com custo/referência de nota; despesas cadastradas à parte | Parcial: falta documento de compra ligando fornecedor, itens recebidos, estoque e contas a pagar. |
| Fluxo de caixa | Movimentos realizados, títulos pendentes e vencimentos | Parcial: falta visão projetada consolidada por dia/semana, com saldo inicial, recebimentos e pagamentos previstos. |
| Recorrências | Cadastro com frequência, datas e campo de última geração | Parcial: não foi encontrado gerador agendado de títulos. O trabalhador atual avalia notificações, não executa essas recorrências. |
| Orçamentos e centros de custo | Cadastros, categorias planejadas/realizadas e vínculo opcional no modelo de transação | Parcial: realizado é informado manualmente no formulário; não foi encontrada apuração automática dos gastos por orçamento ou classificação integrada dos fluxos por centro de custo. |
| Indicadores | Receitas/despesas/estornos, vendas, ticket médio, produtos, categorias, meios de pagamento e alertas de estoque; CSV/PDF | Parcial: falta consolidar resultados por atividade, margem/custo e indicadores de hospedagem. Os principais gráficos de vendas consultam POS; não presumir que representem todo o faturamento da pousada. |
| Fiscal e contador | Referência de nota em movimentação e exportações operacionais | Ausente como fluxo integrado: não há emissão fiscal, situação/documento fiscal vinculado à operação ou exportação contábil específica. CSV/PDF de relatório não substitui documento fiscal. |
| Multiusuário e integridade | Sessões, perfis por setor, exceções individuais, aprovações, versões, transações, reenvios idempotentes e sincronização | Implementado na arquitetura atual; capacidade e comportamento em uso real continuam sujeitos a homologação. |
| Auditoria, alertas e recuperação | Histórico, registros de erros, notificações individuais, trabalhador, backup e segunda pasta | Implementado. Sincronização externa da pasta e teste de restauração periódico são partes da operação do ambiente. |

## Funções específicas da pousada já presentes

- Mapa de quartos, disponibilidade, ocupação, limpeza e bloqueio/manutenção.
- Reservas individuais e de grupo, períodos sem sobreposição, edição, cancelamento e no-show.
- Check-in e check-out, pagamento parcial de hospedagem, quitação exigida na saída e consumo separado.
- Cadastro de hóspedes, histórico, multa, reembolso e crédito associado ao titular.
- Restaurante com mesas, comandas, pedidos, cancelamento e fechamento.
- Receitas com ingredientes, produção com baixa e custo, consumo de funcionários e limite mensal.

Produção registra consumo e rendimento, mas não cria automaticamente saldo de um produto acabado. Para alimentos produzidos em lotes e vendidos depois, isso precisa de um fluxo próprio; não é requisito para toda operação de cozinha.

Indicadores de ocupação por período, diária média e receita por quarto disponível seriam úteis para gestão da pousada. Integração com canais de reserva, cobrança online e agenda de governança/manutenção são evoluções condicionadas à operação, não pré-requisitos universais de ERP.

## O que merece prioridade

1. **Compras integradas:** começar por um registro de compra com fornecedor, itens, recebimento e parcelas a pagar. Recebimento deve atualizar estoque e título de forma transacional, com estorno rastreável. Cotação e aprovação sofisticadas podem esperar.
2. **Conciliação e cartões:** começar com conferência manual e importação CSV de extratos, evitando duplicidades. Para cartões, separar venda, recebível, taxa e liquidação efetiva, em vez de tratar venda como dinheiro imediatamente disponível no banco. Conexão bancária automática pode vir depois.
3. **Recorrências e projeção:** gerar despesas/títulos previstos com proteção contra duplicação; não marcar como pagos automaticamente. Projetar caixa com títulos e datas de liquidação conhecidos.
4. **Resultados gerenciais:** consolidar hospedagem, restaurante e POS sem duplicar receitas; apurar despesas, margem e resultado por período. Automatizar realizado de orçamento e centros de custo quando os vínculos necessários existirem. Diferenciar resultado de caixa de lucro/resultado por competência.
5. **Documentação fiscal e contador:** oferecer registro do documento emitido fora do sistema, vínculo com a operação, status e exportação adequada ao contador. Avaliar integração com emissor existente conforme município/atividade, em vez de desenvolver um motor tributário próprio. A emissão pode continuar externa desde que o processo seja definido e rastreável.

O processo fiscal deve ser definido antes de operar com dados reais, mesmo que a integração automática seja implementada posteriormente. A ordem acima representa dependências e retorno de implementação; não dispensa esse processo externo.

Não incluir como exigência inicial folha de pagamento própria, contabilidade completa, CRM avançado, múltiplas filiais, BI dedicado ou Kubernetes. Esses itens não resolvem as lacunas prioritárias e aumentam a manutenção sem necessidade comprovada.

## Evidências no repositório

- `prisma/schema.prisma`: entidades existentes, inclusive despesas/parcelas, contas/transferências, orçamentos e recorrências; ausência de entidades de documento de compra, extrato, conciliação e liquidação de adquirente.
- `lib/server/operations.ts` e `lib/server/business-finance.ts`: operações transacionais de atendimento, pagamento, estoque, caixa e transferência.
- `components/financial-tab.tsx`: contas, vencimentos, transações e resumo realizado.
- `components/financial-cadastros-management.tsx`: cadastros de orçamento/recorrência, com realizado informado pelo usuário.
- `components/stock/stock-movement-modal.tsx`: entrada manual com custo, referência de nota e validade, separada do cadastro de despesa.
- `lib/hooks/useReports.ts`: resumos e gráficos de vendas originados em POS, além de fluxo realizado por turno.
- `scripts/notification-worker.ts`: avaliação de regras e retenção; não há geração de títulos de recorrência.
- `docs/REGRAS_NEGOCIO.md`, `docs/PERMISSOES.md` e `docs/CONCORRENCIA.md`: regras e limites atuais.

## Referências externas

As referências servem para definir um patamar prático de integração; não significam que o projeto deva copiar toda a complexidade desses sistemas.

- [Sebrae: controle financeiro, entradas/saídas, contas e gestão integrada](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/5-ferramentas-para-digitalizar-seu-financeiro%2C08d66762bedb7810VgnVCM1000001b00320aRCRD)
- [Odoo: vínculo de compras, recebimento e contas de fornecedores](https://www.odoo.com/documentation/19.0/applications/finance/accounting/vendor_bills.html)
- [Odoo: conciliação entre transações bancárias e registros da empresa](https://www.odoo.com/documentation/19.0/applications/finance/accounting/bank/reconciliation.html)
- [Portal oficial NFS-e: emissor e consulta externos](https://www.gov.br/nfse/pt-br/mei-e-demais-empresas)
