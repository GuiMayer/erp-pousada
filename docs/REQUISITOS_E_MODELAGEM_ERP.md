# Requisitos e modelagem funcional — ERP Pousada

**Versão:** 0.4 · **Data:** 09/10/2026 · **Escopo:** pousada e venda de bebidas.

Este documento orienta as próximas sprints. Requisito descrito não significa funcionalidade já implementada. A retirada do restaurante da interface foi executada; os novos fluxos de tarifa e faturamento empresarial continuam sujeitos às sprints e à homologação.

## 1. Mudança de escopo

O cliente contratou outro sistema para o restaurante. O ERP atenderá somente a pousada. O código do restaurante permanece em [módulo abandonado](../modules/abandoned/restaurant/README.md), junto da [modelagem anterior completa](../modules/abandoned/restaurant/docs/REQUISITOS_POUSADA_E_RESTAURANTE.md) e das [respostas do cliente](../modules/abandoned/restaurant/docs/RESPOSTAS_DO_CLIENTE.md).

Mesas, comandas, buffet livre ou por quilo, marmitas, contratos de refeições, receitas de cozinha, produção e consumo de funcionários não entram nas sprints ativas. A Frente de Caixa permanece para vender bebidas. Não haverá funções fiscais nesta etapa.

Não será criada integração com o sistema externo do restaurante sem um pedido posterior e definição concreta dos dados trocados. A mudança de escopo não apaga o histórico armazenado.

## 2. Decisões confirmadas e limites

| Tema | Decisão |
| --- | --- |
| Porte e rotina | Pequena pousada; operação simples para uma equipe de aproximadamente cinco funcionários. |
| Diária | Cobrada por pessoa; varia por quarto e quantidade de hóspedes. Configurar uma tabela por quarto/tipo e ocupação, evitando multiplicação fixa quando houver faixas. |
| Empresas | Algumas pagam depois da saída; a conta permanece em aberto para acompanhamento e cobrança. |
| Bebidas | Catálogo com preço padrão, Frente de Caixa e estoque da pousada. |
| Restaurante | Fora do escopo ativo; usa outro sistema e possui caixa e contas próprios. |
| Visual | Preservar o estilo atual; adaptar os fluxos com o mínimo de complexidade. |
| Instalação | Banco PostgreSQL e aplicação em Docker no computador da pousada; backup em pasta local configurável. |
| Acesso remoto | Tailscale é uma opção do operador descrita no guia, sem se tornar dependência oficial do produto. |
| Demonstração | Ambiente e banco separados; exemplos fictícios e alterações descartáveis. |

As confirmações anteriores relativas a pagamentos do restaurante não criam uma funcionalidade ativa de lançamento entre os dois sistemas. Consumos de bebidas da pousada continuam associados à hospedagem quando cabível.

## 3. Organização das telas

| Tela | Responsabilidade e foco |
| --- | --- |
| Mapa | Situação dos quartos, ocupação, entradas, saídas, limpeza, bloqueios e consumo da hospedagem. |
| Reservas | Cliente, responsável pelo pagamento, período, quarto, ocupação, tarifa, descontos, sinais e situação da reserva. |
| Frente de Caixa | Venda rápida de bebidas, busca, carrinho, pagamento ou consumo na hospedagem, histórico e estorno autorizado. |
| Estoque | Bebidas, categorias, preços padrão, entradas, ajustes, perdas, saldo e reposição. Lotes e validade entram na sprint de estoque. |
| Financeiro | Contas bancárias, caixa, despesas, fornecedores, clientes, títulos a receber, cobrança e recebimentos. |
| Relatórios | Ocupação, receitas de hospedagem e bebidas, pendências, despesas, caixa e estoque. Exportações de reservas e estoque permanecem. |
| Configurações | Dados da pousada e preferências pessoais. |
| Administração | Usuários, permissões, parâmetros operacionais e recuperação. |
| Auditoria | Quem realizou cada alteração, histórico e investigação de erros. |

Cadastros simples devem ser reaproveitados. Não criar uma tela para cada entidade se o cadastro puder ser acessado no fluxo correspondente. Diferenciar hóspedes, clientes e pagadores na interface sem duplicar o cadastro da mesma pessoa.

## 4. Modelo conceitual alvo

~~~mermaid
erDiagram
  CLIENTE ||--o{ RESERVA : contrata
  CLIENTE ||--o{ TITULO_RECEBER : deve
  QUARTO ||--o{ RESERVA : ocupa
  QUARTO ||--o{ TARIFA_OCUPACAO : precifica
  RESERVA ||--o{ HOSPEDE_RESERVA : identifica
  RESERVA ||--o{ CONSUMO : acumula
  RESERVA ||--o{ TITULO_RECEBER : origina
  PRODUTO ||--o{ ITEM_VENDA : compoe
  PRODUTO ||--o{ MOVIMENTO_ESTOQUE : movimenta
  PRODUTO ||--o{ LOTE : controla
  FORNECEDOR ||--o{ COMPRA : fornece
  COMPRA ||--o{ LOTE : recebe
  VENDA ||--|{ ITEM_VENDA : contem
  TITULO_RECEBER ||--o{ RECEBIMENTO : quita
  CONTA_FINANCEIRA ||--o{ RECEBIMENTO : recebe
  TURNO_CAIXA ||--o{ VENDA : registra
~~~

O mapa representa o alvo funcional, não o esquema Prisma atual. Priorizar reaproveitamento das entidades existentes. Toda venda ou consumo deve guardar o preço aplicado; mudar o preço padrão não altera documentos anteriores. A tarifa aplicada à reserva também deve ser preservada.

## 5. Requisitos para as sprints

| ID | Requisito | Critério de aceitação |
| --- | --- | --- |
| PO-01 | Cadastro único de pessoa e empresa, com cliente/pagador, contato e documento. | A mesma empresa pode pagar estadias de hóspedes diferentes sem duplicar o cadastro. |
| PO-02 | Busca cadastral por CNPJ opcional e conferida pelo operador. | Falha na consulta permite cadastro manual; documento fica como texto e suporta evolução do formato. |
| PO-03 | Cadastro de fornecedores de bebidas e despesas. | Uma entrada ou conta a pagar pode identificar o fornecedor. |
| PO-04 | Produtos com categoria, unidade, preço padrão, código de barras opcional e controle de estoque. | Carrinho usa o preço padrão e preserva o preço de cada venda. |
| PO-05 | Tabela de diária por quarto/tipo e quantidade de hóspedes. | Reservas de um, dois e três hóspedes podem ter valores diferentes configurados; a tela explica o cálculo. |
| PO-06 | Identificar hóspedes e pagador da hospedagem separadamente. | Uma reserva empresarial identifica quem ficou e quem será cobrado. |
| PO-07 | Reservas com período válido, bloqueio de sobreposição e mudança de quarto controlada. | Dois operadores não confirmam reservas incompatíveis para o mesmo quarto. |
| PO-08 | Check-in, limpeza, bloqueios e check-out coerentes. | Saída atualiza ocupação sem apagar despesas ou consumo pendentes. |
| PO-09 | Permitir saída com pagamento empresarial posterior autorizado. | A saída cria ou vincula dívida ao pagador; o saldo não desaparece nem é marcado como pago. |
| PO-10 | Títulos a receber com vencimento, saldo, pagamento parcial e histórico. | Recebimento reduz o saldo e gera lançamento financeiro uma única vez. |
| PO-11 | Cobrança simples por empresa ou cliente. | Consultar saldo aberto, vencido e estadias relacionadas, com relatório ou extrato. |
| PO-12 | Venda de bebidas no caixa ou consumo vinculado à hospedagem. | Baixa de estoque e cobrança não se duplicam quando um consumo é quitado. |
| PO-13 | Recebimento de compra de bebidas com custo, quantidade, fornecedor e validade quando aplicável. | Entrada gera saldo e, quando a prazo, conta a pagar relacionada. |
| PO-14 | Lotes, validade, perdas e inventário simples. | Alertar vencimentos, impedir uso de lote vencido e registrar ajuste com motivo. |
| PO-15 | Abertura e fechamento de turno, meios de pagamento e contas. | Divergências ficam explícitas; estorno autorizado preserva a rastreabilidade. |
| PO-16 | Despesas, pagamentos e transferências identificados. | Transferência entre contas não vira receita ou despesa operacional. |
| PO-17 | Indicadores úteis ao proprietário. | Ocupação, saldo a receber, receitas, despesas e reposição usam dados reais do período. |
| PO-18 | Permissões individuais e aprovações. | Recepção e caixa operam apenas o necessário; supervisão controla descontos, cancelamentos e estornos. |
| PO-19 | Concorrência e integridade. | Edição desatualizada é recusada com orientação; ações repetidas não duplicam lançamentos. |
| PO-20 | Recuperação e backup verificável. | Cópia configurável em pasta local e restauração testada em ambiente separado. |

Multa e crédito em cancelamento já pago seguem a decisão anterior: valores definidos pelo supervisor, com histórico e autorização. Detalhes ainda não respondidos serão apresentados no protótipo ou parametrizados quando isso preservar a simplicidade; não abrir nova rodada de perguntas por decisões de desenvolvimento.

## 6. Sequência revisada das sprints

1. **Base cadastral e preços da pousada:** clientes/pagadores, fornecedores, catálogo de bebidas e tabela de diária por ocupação. Reutilizar cadastros e definir vínculos antes dos novos movimentos.
2. **Hospedagem e faturamento empresarial:** reservas usando tarifas, hóspedes e pagador, saída com dívida autorizada, títulos e extrato de cobrança.
3. **Compras e estoque de bebidas:** entrada de fornecedor, custo, pagamento, lotes, validade, perdas e inventário.
4. **Caixa e financeiro integrados:** venda/consumo/recebimento sem duplicação, turnos, conciliação simples e estornos.
5. **Homologação e operação:** relatórios, mobile, permissões, concorrência, demonstração, backup e recuperação com cenários reais.

Cada sprint entrega um fluxo completo demonstrável e critérios de aceitação testados. A primeira sprint não depende das regras do restaurante nem exige modelar duas unidades operacionais. A implementação da aposentadoria do restaurante não significa início automático das demais sprints.

## 7. Princípios de arquitetura e referências

Manter uma aplicação modular e um banco transacional, com comandos de negócio no servidor, validação de permissões, efeitos financeiros/estoque atômicos, versões para conflito e identificadores para repetição segura. Usar movimentos rastreáveis e estornos em vez de apagar fatos financeiros. Reaproveitar a infraestrutura atual e evitar serviços distribuídos para este porte.

A pesquisa detalhada anterior permanece na seção 2 do documento arquivado. Para o escopo atual, continuam pertinentes as referências oficiais sobre [clientes e contatos no Odoo](https://www.odoo.com/documentation/19.0/applications/essentials/contacts.html), [lotes e validade](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html) e a organização por funções do [Business Central](https://learn.microsoft.com/en-au/dynamics365/business-central/dev-itpro/developer/devenv-designing-role-centers). Consultar novamente a documentação vigente ao implementar cada integração; a referência é de modelagem, não uma dependência desses produtos.

## 8. Compatibilidade na retirada do restaurante

As telas e componentes exclusivos foram movidos ao módulo abandonado. Tipos, tabelas de banco, permissões de servidor e operações compartilhadas continuam por compatibilidade. A aplicação não consulta normalmente as coleções exclusivas do restaurante e não oferece seus relatórios, preferências ou formulários.

O catálogo e o estoque ocultam produtos classificados como restaurante. Histórico financeiro e auditoria não são apagados. Produtos legados com classificação desconhecida permanecem visíveis para revisão manual. Os exemplos novos não criam comandas, produção ou usuários do restaurante.
