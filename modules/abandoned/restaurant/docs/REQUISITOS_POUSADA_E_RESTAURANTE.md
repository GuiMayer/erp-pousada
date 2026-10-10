# Requisitos e modelagem funcional — pousada e restaurante

**Versão:** 0.3, para revisão com o proprietário e os funcionários.

**Data:** 9 de outubro de 2026.

**Base:** código local do ERP Pousada e pesquisa de referências públicas.

**Finalidade:** definir o negócio, os dados, as telas e os critérios de aceitação antes de implementar mudanças.

Este documento descreve o sistema desejado. A indicação de um requisito não significa que ele já esteja implementado ou aprovado. As constatações sobre o aplicativo atual resultam de leitura do código, do esquema relacional e dos guias existentes; esta atividade não foi uma homologação de todos os formulários no navegador.

Os documentos anteriores descrevem revisões e regras de versões existentes. Este documento é a proposta de referência para a próxima modelagem, sujeita às decisões da seção 15. Não altera as regras em produção.

## Sumário

1. Contexto, limites e decisões confirmadas
2. Pesquisa e aplicação das referências
3. Princípios e decisões de desenho
4. Revisão das telas existentes
5. Organização proposta das telas
6. Pessoas, funções e permissões
7. Modelo conceitual e relacionamentos
8. Requisitos funcionais
9. Especificação das principais telas
10. Fluxos de ponta a ponta
11. Estados e regras de transição
12. Relatórios, conceitos e cálculos
13. Requisitos de qualidade e operação
14. Cenários de aceitação
15. Decisões pendentes
16. Processo de validação antes da implementação
17. Glossário e evidências locais

## 1. Contexto, limites e decisões confirmadas

### 1.1 Informações fornecidas

| Tema | Definição confirmada |
| --- | --- |
| Porte | Pequeno negócio, aproximadamente cinco funcionários. |
| Atividades | Pousada e restaurante são operações separadas. |
| Pousada | Gestão de hospedagem; estoque próprio somente de bebidas. |
| Restaurante | Operação completa, com marmitas, buffet e contratos com empresas. |
| Buffet | O sistema deve oferecer buffet livre e buffet por quilo, com preços padrão próprios. |
| Contrato empresarial | Fornecimento de X refeições para Y funcionários por dia. Quantidade diária e número de funcionários fazem parte do acordo. |
| Tarifa da pousada | Diária por pessoa, variável conforme quarto; deve permitir configurar valores conforme quantidade de hóspedes. |
| Hospedagem empresarial a prazo | Empresas podem pagar depois da saída. Encerrar a hospedagem mantém a conta financeira aberta para acompanhamento e cobrança. |
| Restaurante e hóspedes | Pode receber diretamente no restaurante ou lançar consumo na conta da hospedagem. |
| Estilo visual | O estilo atual está satisfatório e deve ser preservado. |
| Produto | Interface simples, com decisões de negócio deliberadas e controles suficientes para gerir a operação. |
| Fiscal | Sem funções fiscais nesta etapa. |
| Infraestrutura pretendida | Servidor no computador da pousada, com Docker. Tailscale é uma opção de acesso escolhida pelo responsável, não uma dependência oficial do aplicativo. |
| Demonstração | Dados de exemplo isolados do ambiente operacional, com descarte das alterações. |
| Política já definida | No cancelamento de reserva paga, supervisor pode definir multa e destinação em reembolso ou crédito. |

### 1.2 O que ainda não sabemos

Separação operacional não esclarece se existem dois CNPJs, duas contas bancárias ou dois caixas físicos. As modalidades de buffet estão definidas: livre e por quilo. No contrato, ainda é necessário esclarecer se X representa o total diário do grupo ou a quantidade diária por funcionário, quais dias e refeições são atendidos e como faltas e excedentes afetam a cobrança. Também falta saber como a empresa comprova as refeições consumidas, se há entrega de marmitas e se despesas comuns são divididas.

Essas informações são decisões pendentes, não fatos presumidos. O modelo distingue unidade operacional de pessoa jurídica, permitindo validar os dois assuntos separadamente.

As respostas sobre tarifa, pagamento empresarial depois da saída e consumo do restaurante foram confirmadas em 09/10/2026. Não devem ser perguntadas novamente antes do protótipo. A seção 15.2 delimita a rodada única de perguntas ainda necessária; os demais detalhes serão configuráveis ou apresentados no protótipo.

### 1.3 Escopo da gestão

O núcleo deve cobrir clientes e fornecedores; catálogo e preços; hospedagens; atendimento do restaurante; fornecimento a empresas; compras; estoque e validade; produção de cozinha; despesas; cobranças; recebimentos; pagamentos; caixa e bancos; resultados por atividade; acessos; auditoria e recuperação dos dados.

“Completo para um pequeno negócio” significa que esses ciclos fecham sem redigitar os mesmos fatos em vários lugares. Não significa acrescentar todos os módulos de um ERP corporativo.

### 1.4 Fora do escopo desta etapa

- Emissão, validação, cálculo ou transmissão de documentos fiscais e tributos.
- Contabilidade oficial, folha de pagamento, obrigações trabalhistas e escrituração.
- Motor de reservas online, canais de hospedagem e precificação dinâmica.
- Integrações automáticas com bancos, maquininhas, marketplaces ou aplicativos de entrega.
- Roteirização de entregas, rastreamento de entregadores e aplicativo próprio para clientes.
- Planejamento industrial, MRP, múltiplos níveis de aprovação e BI separado.
- Gravação offline com reconciliação posterior.
- Gestão de enxoval, materiais de limpeza e manutenção como estoques da pousada. Seus gastos podem ser registrados como despesas.

Cadastro de CNPJ, referência de documento recebido, comprovante interno e demonstrativo de cobrança são informações cadastrais ou gerenciais. Não tornam o aplicativo um emissor fiscal.

## 2. Pesquisa e aplicação das referências

Pesquisa realizada em documentação oficial de produtos, orientação para pequenos negócios e referências de usabilidade. Páginas comerciais foram usadas para identificar rotinas anunciadas, não para comprovar desempenho, popularidade ou qualidade dos fornecedores. Não foi realizado teste comparativo desses produtos.

As adaptações abaixo são propostas próprias para este negócio. Não são exigências impostas pelas referências.

| Referência e evidência | Aplicação proposta | Complexidade que não será copiada |
| --- | --- | --- |
| Microsoft Business Central: entrada orientada ao papel do usuário e acesso às tarefas frequentes. [Role Centers](https://learn.microsoft.com/en-au/dynamics365/business-central/dev-itpro/developer/devenv-designing-role-centers) | Recepção começa na pousada; atendimento começa no restaurante; proprietário vê pendências e resultados. | Painéis configuráveis por dezenas de cargos. |
| Microsoft Business Central: lista para localizar registros e ficha para consultar ou alterar um registro. [List Pages](https://learn.microsoft.com/ja-jp/dynamics365/business-central/dev-itpro/developer/devenv-designing-list-pages) | Mesmo padrão para clientes, fornecedores, compras e contratos; detalhes com histórico e documentos relacionados. | Reproduzir a navegação e os componentes visuais do produto. |
| Nielsen Norman Group: opções menos frequentes podem ficar em uma camada secundária. [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Cadastro rápido no atendimento; dados complementares e ações excepcionais na ficha. | Esconder saldo, unidade, preço ou consequência financeira, que são informações essenciais. |
| Cloudbeds: calendário operacional, dados da reserva, hóspedes e conta da hospedagem. [Mapa de navegação](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/16464111837211-General-Information-Cloudbeds-PMS-Menus-and-Site-Map), [detalhes da reserva](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/17794963964187-Manage-the-Reservation-Details-Page-tabs) | Manter mapa de quartos e concentrar período, hóspedes, responsável financeiro, cobranças e histórico na hospedagem. | Channel manager, portal do hóspede, cartões armazenados e gestão de redes hoteleiras. |
| Odoo: mesas, comandas e acompanhamento operacional do salão. [Floors and tables](https://www.odoo.com/documentation/17.0/applications/sales/point_of_sale/restaurant/floors_tables.html) | Preservar mapa de mesas; acrescentar pedidos de balcão e marmitas sem mesa fictícia. | Planta gráfica livre, cursos de serviço e infraestrutura complexa de cozinha. |
| Consumer: self-service com itens por peso e por unidade. [Self-service](https://consumer.com.br/sistema-self-service) | Buffet por quilo exige quantidade decimal, tara e preço/kg; a oferta de buffet livre tem preço próprio por pessoa/refeição. Bebidas permanecem por unidade. | Integração com balança ou emissão fiscal nesta etapa. |
| Consumer: compras na conta de um cliente, extrato e limite de crédito. [Controle de fiado](https://consumer.com.br/sistema-controle-fiado) | Empresa pagadora identificada, consumo rastreável e cobrança periódica; autorização para vendas a prazo. | Cobranças automáticas por WhatsApp e integração de pagamento. |
| Saipos: relacionamento entre pedidos, ficha técnica, estoque e gestão financeira. [Gestão de restaurante](https://saipos.com/sistema/restaurante) | Um fato operacional gera seus efeitos relacionados; separar margem estimada de apuração por inventário. | Ecossistema de integrações e promessa de lucro exato sem dados completos. |
| Sebrae: compras, armazenamento, perdas, rendimento e ficha técnica são controles úteis para restaurantes pequenos. [Cardápio de sucesso](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/bis/cardapio-de-sucesso-para-restaurantes%2C174810bb307a1510VgnVCM1000004c00210aRCRD) | Recebimento de compra, lote, validade, consumo de ingredientes e registro simples das perdas. | Exigir ficha detalhada de todos os pratos antes de registrar a primeira venda. |
| ERPNext: acordo de fornecimento com cliente, período, itens, quantidades e preços, usado por operações posteriores. [Blanket Order](https://docs.frappe.io/erpnext/blanket-order) | Separar contrato, fornecimento realizado e cobrança da empresa. | Transformar a assinatura do contrato em venda, entrega ou recebimento automático. |
| Odoo: compras, recebimentos e contas do fornecedor têm vínculos, podendo existir cobrança por quantidades recebidas. [Vendor bills](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/manage.html) | Tela simples “Receber compra”, com estoque e obrigação financeira relacionados; admitir recebimento parcial quando necessário. | Cotação obrigatória e conferência de três documentos em toda compra pequena. |
| Odoo: validade pertence ao lote e a retirada pode priorizar o vencimento mais próximo. [Validade](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html), [FEFO](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html) | Saldo por lote/local; sugestão de lote válido que vence primeiro; vencidos bloqueados para uso. | Serializar cada garrafa ou criar dezenas de endereços de armazenamento. |
| ERPNext: estoque por local e classificação de resultados por área são conceitos distintos. [Warehouse](https://docs.frappe.io/erpnext/v14/user/manual/en/stock/warehouse), [Cost Center](https://docs.frappe.io/erpnext/v14/user/manual/en/accounts/cost-center) | Dois estoques iniciais e resultado por unidade; compartilhar cadastro não mistura saldos. | Árvore de depósitos e centros de custo sem necessidade operacional. |
| ERPNext: recebimento/pagamento é uma operação própria, com valores parciais, adiantamentos e alocação a obrigações. [Payment Entry](https://docs.frappe.io/erpnext/payment-entry) | Separar cobrança, pagamento e movimentação de conta; permitir quitação parcial e um pagamento para vários títulos. | Livro contábil completo e regras tributárias. |
| Receita Federal e BrasilAPI: o cadastro precisa contemplar CNPJ alfanumérico e consulta cadastral opcional. [Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico), [BrasilAPI](https://brasilapi.com.br/docs) | Identificador textual validado, consulta sob demanda, conferência humana e alternativa manual. | Tratar consulta como certificado de regularidade ou exigir API externa para vender. |
| W3C: controles precisam de tamanho ou espaçamento adequado para acionamento. [WCAG 2.2 — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Proposta de alvos de toque de 44 px nas ações frequentes; teclado, foco visível e informação além da cor. | Alegar conformidade integral de acessibilidade sem avaliação específica. |

### 2.1 Conclusões aplicáveis

1. A simplicidade deve vir de valores padrão, poucos campos obrigatórios e caminhos frequentes curtos.
2. Cadastro, operação, cobrança e pagamento precisam de identidades e histórias próprias.
3. A ligação entre documentos evita trabalho duplicado e permite conferir números.
4. Operação de restaurante não pode depender exclusivamente de mesas.
5. Um contrato comercial não substitui o registro do que foi efetivamente fornecido.
6. Estoque, resultado e dinheiro são três visões diferentes. O sistema deve mostrar como se relacionam.
7. Recursos externos, como consulta de CNPJ e balança, devem ser complementos substituíveis.

## 3. Princípios e decisões de desenho

As decisões com situação “proposta” precisam de revisão. A justificativa permite reconsiderá-las sem perder a intenção.

| ID | Decisão | Situação | Justificativa e consequência |
| --- | --- | --- | --- |
| D01 | Duas unidades operacionais: Pousada e Restaurante. | Confirmada no negócio | Toda operação e resultado identificam sua unidade. |
| D02 | Dois estoques iniciais: Bebidas da pousada e Estoque do restaurante. | Confirmada no negócio | Nenhuma baixa pode usar silenciosamente o saldo da outra unidade. |
| D03 | Uma aplicação e uma base operacional, com separação explícita por unidade. | Proposta | Facilita manutenção e consulta consolidada; autorização continua necessária por unidade. |
| D04 | Unidade operacional não equivale a CNPJ. | Proposta | Evita assumir estrutura jurídica não informada. Contas compartilhadas dependem da confirmação dessa estrutura. |
| D05 | Cadastro de pessoa reutilizável, com papéis cliente, fornecedor e hóspede. | Proposta | Uma pessoa pode hospedar-se e consumir; uma empresa pode comprar e fornecer. As telas mantêm nomes familiares. |
| D06 | Hóspede, cliente pagador e beneficiário de refeição são vínculos diferentes. | Proposta | Quem consome nem sempre paga. Não transformar funcionário de empresa em usuário do ERP. |
| D07 | Produto físico, preparação de cozinha e serviço são tipos de item distintos. | Proposta | Diária não tem estoque; ingrediente não precisa ter preço de venda; preparação tem receita e forma de baixa. |
| D08 | Produto pode ter preço e disponibilidade diferentes por unidade. | Proposta | Mesma bebida pode existir nos dois negócios, com estoques e preços independentes. |
| D09 | Preço contratado tem vigência e o preço aplicado fica preservado na operação. | Proposta | Reajuste não altera pedido, fornecimento ou reserva já acordados. |
| D10 | Financeiro distingue obrigação, liquidação e movimento de dinheiro. | Proposta | Venda a prazo gera dívida; recebê-la não gera uma segunda venda. |
| D11 | Caixa físico tem turno e responsável; vínculo operacional identifica a unidade. | Proposta | Um caixa físico pode atender ambas as unidades se confirmado; relatório por unidade permanece separado. |
| D12 | Movimentos confirmados são corrigidos por estorno/ajuste vinculado. | Proposta | Evita apagar histórico financeiro, de estoque e de fornecimento. |
| D13 | Preparações têm uma única estratégia de baixa por fluxo. | Proposta | Ingrediente baixado na produção não pode ser baixado outra vez na venda. |
| D14 | Buffet em lote usa produção e inventário, sem inferir ingredientes pelo peso do prato. | Proposta | O peso vendido não revela a composição do prato. Dados incompletos não justificam custo exato por cliente. |
| D15 | Contrato de empresa é entidade central do restaurante. | Confirmada como necessidade | Vigência, tabela acordada, fornecimentos, fechamento e cobrança devem ficar relacionados. |
| D16 | Consumo da pousada pertence à hospedagem, não apenas ao quarto. | Proposta | Troca de quarto e próximo hóspede não podem misturar contas. |
| D17 | Restaurante pode receber diretamente ou lançar na conta da hospedagem. | Confirmada | Conta agrupada não mistura receita nem estoque: origem restaurante e liquidação alocada por unidade permanecem rastreáveis. |
| D18 | Manter estilo visual; revisar conteúdo e sequência das tarefas. | Confirmada | Reusar cartões, tabelas e componentes atuais onde fizerem sentido. |
| D19 | Consulta de CNPJ não bloqueia cadastro manual. | Proposta | Atendimento local não depende da disponibilidade de um serviço externo. |
| D20 | Sem módulo fiscal nesta versão. | Confirmada | Campos cadastrais e comprovantes gerenciais não devem ser apresentados como emissão fiscal. |
| D21 | Buffet livre e buffet por quilo são modalidades explícitas, com preços independentes. | Confirmada como necessidade | Livre cobra por pessoa/refeição; por quilo cobra peso líquido. Não converter um modo no outro implicitamente. |
| D22 | Contrato registra X refeições, Y funcionários e frequência diária. | Confirmada na estrutura | A base de X e a regra de cobrança precisam ser explícitas; não presumir total X × Y nem cobrar previsão como consumo. |
| D23 | Diária por pessoa e preço configurável por quarto/quantidade de hóspedes. | Confirmada | Cada noite conserva ocupação cobrada e tarifa por pessoa utilizada; capacidade do quarto é verificada separadamente. |
| D24 | Hospedagem pode ser encerrada com cobrança empresarial pendente. | Confirmada | Saída libera a operação do quarto; conta a receber continua aberta, com empresa pagadora, saldo e vencimento. |

## 4. Revisão das telas existentes

Inventário por superfície funcional. Formulários internos são agrupados quando tratam a mesma tarefa. A revisão avalia finalidade, dados e vínculos; não propõe trocar a identidade visual.

**Classificação:** manter = finalidade adequada; revisar = preservar finalidade e ajustar modelo/fluxo; reorganizar = mudar localização; acrescentar = não identificado no fluxo atual.

| Tela ou formulário atual | Constatação no código | Decisão de modelagem |
| --- | --- | --- |
| Login | Autenticação e indicação de demonstração. | Manter. Identificar ambiente e negócio sem expor dados operacionais. |
| Cabeçalho e navegação desktop/mobile | Dez módulos principais e navegação conforme permissão. | Revisar agrupamento por rotina e mostrar unidade ativa. |
| Mapa de quartos e filtros | Situações de ocupação, limpeza e bloqueio. | Manter. Distinguir disponibilidade no período de condição física do quarto. |
| Cadastro de quartos | Número, tipo e condições operacionais; sem tarifa padrão. | Revisar. Categoria, capacidade, ocupação permitida e tarifa. |
| Check-in | Titular, documento, período e valor da hospedagem. | Revisar. Buscar pessoa, selecionar pagador e sugerir valor das diárias. |
| Bloqueio/liberação de quarto | Motivo, prazo e responsável. | Manter. Conflitos com reservas precisam de tratamento explícito. |
| Consumo do quarto | Catálogo geral e itens livres; consumo relacionado ao quarto; itens com descrição e preço. | Revisar. Conta da hospedagem, bebidas da pousada e produto identificado para baixa de seu estoque. |
| Pagamento de hospedagem | Pagamento parcial, saldo e crédito. | Manter controles; relacionar títulos, pagamentos e extrato da hospedagem. |
| Check-out e limpeza | Exige quitação e consumo resolvido; quarto entra em limpeza. | Revisar. Saída de hospedagem empresarial a prazo mantém cobrança aberta; saída física e quitação são estados distintos. |
| Reservas, edição, grupos e cancelamento | Períodos e quartos vinculados; valores manuais. | Revisar. Reserva com acomodações, tarifas por noite, pagador e hóspedes; grupo precisa de referência comum. |
| Frente de Caixa | Catálogo, carrinho, fechamento, descontos e histórico. | Revisar. Unidade, cliente identificado quando necessário, quantidades fracionadas e liquidação separada da venda. |
| Histórico de vendas e estorno | Venda concluída/cancelada e devolução física. | Manter. Vincular motivos e movimentos compensatórios, incluindo estorno parcial. |
| Mapa de mesas | Ocupação e comanda ativa. | Manter para salão. Não reutilizar como cadastro de balcão ou empresa. |
| Comanda e fechamento | Pedido vinculado obrigatoriamente a mesa; cliente principalmente textual. | Revisar. Pedido pode ser mesa, balcão, marmita ou empresa; cliente/pagador com identidade. |
| Cadastro de mesas | Número, capacidade e situação; ligação opcional com quarto. | Manter mesas. Remover dependência de quarto como mecanismo implícito de cobrança entre negócios. |
| Cadastro de receitas | Ingredientes, rendimento, unidade e instruções. | Revisar vínculo com preparação/produto e estratégia de baixa. |
| Registro e histórico de produção | Consome ingredientes e registra custo/rendimento; não cria produto acabado. | Revisar. Produção em lote cria saída identificada quando a rotina requer saldo preparado. |
| Funcionários | Dados e condições de consumo. | Manter cadastro mínimo; separar funcionário de usuário de acesso. |
| Consumo de funcionários | Benefício, desconto ou pagamento e limites. | Manter. Unidade e custo ficam identificados; benefício não é venda recebida. |
| Catálogo de produtos | Preço de venda e opção de controle de estoque. | Revisar. Ingrediente, bebida, embalagem, preparação e serviço; oferta/preço por unidade. |
| Cardápio do restaurante | Cadastro separado na interface, baseado no catálogo/categorias. | Manter como visão do catálogo; evitar dois cadastros independentes para o mesmo item. |
| Categorias PDV/restaurante | Marcador identifica restaurante. | Revisar. Categoria é organização; unidade operacional é vínculo próprio. |
| Movimentações de estoque | Saldo único por produto; entrada/saída/ajuste e validade no movimento. | Revisar. Local, lote, documento de origem e saldo por lote. |
| Configurações de estoque | Mínimo e máximo. | Manter por item e local; alerta considera saldo utilizável. |
| Financeiro — Vencimentos | Despesas e parcelas. | Reorganizar como Contas a pagar; receber compra gera vínculo com o fornecedor. |
| Nova despesa e categorias | Lançamento manual. | Manter para serviços e gastos sem mercadoria. Não duplicar obrigação já gerada por compra. |
| Financeiro — Transações e estornos | Histórico financeiro e ajustes. | Revisar como extrato de caixa/conta com origem e unidade; distinguir venda e recebimento. |
| Clientes e cadastro rápido | Cadastro existente, documentos, contato e endereço. | Reorganizar em Cadastros, acessível nas operações; pessoa física/jurídica e busca opcional de CNPJ. |
| Histórico do cliente | Principalmente contas a receber. | Revisar. Hospedagens, pedidos, contratos, cobranças e crédito, conforme permissão. |
| Hóspedes | Cadastro separado por CPF e indicadores. | Reorganizar como visão de pessoas/hospedagens; documento não será chave técnica do histórico. |
| Fornecedores | Contatos e condições de pagamento. | Reorganizar em Cadastros/Compras; histórico de recebimentos e valores a pagar. |
| Contas a receber | Títulos, parcelas e pagamentos. | Revisar origem automática de vendas/fechamentos e alocação de pagamentos parciais. |
| Contas bancárias e transferências | Saldo interno e transferência. | Manter. Identificar titularidade/unidades e conferência de extrato. |
| Centros de custo | Cadastro geral, vínculo opcional. | Simplificar unidade operacional como classificação principal; centros adicionais ficam secundários. |
| Orçamentos | Previsto e realizado editados no cadastro. | Retirar da rotina inicial; não priorizar sobre compras, contratos ou estoque. |
| Recorrências | Cadastro, sem geração periódica integrada identificada. | Revisar. Gerar obrigações previstas sem pagamento automático e sem duplicação. |
| Abrir/fechar turno | Um caixa compartilhado aberto por vez. | Revisar cardinalidade segundo caixas físicos; turno separado de contas bancárias. |
| Relatórios — Visão Geral/Vendas/Produtos/Estoque | Gráficos de vendas usam principalmente POS. | Revisar abrangência e fórmulas; não apresentar vendas POS como total do negócio. |
| Preferências | Tema, gráficos e notificações pessoais. | Manter, fora das configurações comerciais. |
| Administração — Dados do negócio | Configuração global centrada na pousada. | Revisar como configuração de unidades e políticas comuns. |
| Administração — Usuários/permissões | Perfis, exceções individuais e aprovação por operação. | Manter. Acrescentar escopo por unidade e novas operações de compras/contratos. |
| Central de notificações | Eventos e regras com leitura individual. | Manter; acrescentar pendências de contratos e validade, com links para resolução. |
| Auditoria | Histórico filtrável. | Manter. Documento, unidade, executor, aprovador e motivo. |
| Exportação, restauração e limpeza | Ferramentas administrativas. | Manter restritas. Separar exportação gerencial de backup completo. |
| Revisão de conflito | Comparação da edição com registro atualizado. | Manter para cadastros; confirmar operação contra o estado vigente. |
| Painel externo de servidores | Inicialização, parada, acesso e diagnósticos. | Preservar como operação do ambiente; não misturar com tarefas do atendente. |
| Contratos e fechamento empresarial | Não identificados como fluxo próprio. | Acrescentar. Prioridade central do restaurante. |
| Buffet e marmitas | Não identificados como modalidades completas de pedido. | Acrescentar dentro do atendimento do restaurante. |
| Compras integradas e recebimentos | Cadastro de fornecedor, estoque e despesas separados. | Acrescentar documento e fluxo integrado. |
| Lotes, validade e inventário | Sem saldo relacional por lote/local. | Acrescentar rotinas completas. |
| Tarifa padrão e preços acordados | Produtos têm preço; hospedagem não tem tarifa estruturada. | Acrescentar catálogo de preços simples, com vigência. |

Evidência central: [navegação](../components/dashboard-shell.tsx), [financeiro](../components/financial-tab.tsx), [restaurante](../components/restaurant/restaurant-tab.tsx), [estoque](../components/stock/stock-tab.tsx) e [modelo atual](../prisma/schema.prisma).

## 5. Organização proposta das telas

O menu não é uma obrigação de layout. Define onde cada rotina pertence; pode ser apresentado com os componentes atuais.

~~~text
Início — tarefas do dia e unidade ativa
Pousada
  Quartos e disponibilidade
  Reservas e hospedagens
  Conta da hospedagem / bebidas
  Tarifas e quartos
Restaurante
  Atendimento: mesas, balcão, buffet e marmitas
  Pedidos: preparo, retirada e entrega
  Empresas: contratos, fornecimentos e fechamentos
  Cozinha: fichas técnicas, produção e perdas
Compras e estoque
  Receber compra / compras registradas
  Saldos, lotes e validade
  Inventário, ajustes e transferências
Financeiro
  Caixa e turnos
  Contas a pagar / contas a receber
  Contas e conferência de extrato
  Fluxo previsto e realizado
Cadastros
  Clientes / fornecedores
  Itens / cardápio / preços
Gestão
  Relatórios por unidade e consolidados
  Usuários, políticas, auditoria e recuperação
Preferências pessoais
~~~

Operador vê apenas os grupos autorizados. “Todos os negócios” é uma visão gerencial; não será um contexto implícito para lançar venda ou baixa de estoque. A unidade da operação fica visível na confirmação.

## 6. Pessoas, funções e permissões

Cinco funcionários não exigem cinco perfis fixos. Uma pessoa pode acumular funções sem usar a conta de outra.

| Função | Tarefas frequentes | Informações necessárias |
| --- | --- | --- |
| Proprietário/gestor | Preços, contratos, compras, resultados, crédito e exceções. | Ambas as unidades quando autorizado; pendências e origem dos números. |
| Recepção | Reservar, receber, entrar/sair hóspedes e lançar bebidas. | Disponibilidade, conta da hospedagem e estoque de bebidas da pousada. |
| Atendimento/caixa restaurante | Mesas, buffet, marmitas, venda e recebimento. | Cardápio, preço aplicado, pedido, pagador e saldo da conta do cliente autorizado. |
| Cozinha/estoque | Preparo, produção, recebimento, validade e perdas. | Quantidades, prioridade, ingredientes e lotes; não precisa ver bancos ou senha de cliente. |
| Administrativo | Pagar fornecedores, fechar empresas, conferir contas e cobranças. | Obrigações, pagamentos, demonstrativos e dados de contato. |

Permissão combina **ação + unidade + restrições do documento**. Poder cadastrar um cliente não implica poder conceder crédito, consultar resultado ou estornar dinheiro.

O sistema deve oferecer perfis iniciais e exceções individuais, preservando a arquitetura atual de autorização no servidor. Acesso às duas unidades não deve ser concedido automaticamente por ter um perfil chamado “caixa”.

### 6.1 Matriz proposta de poderes

| Ação | Operador habilitado | Poder adicional/exceção | Restrição |
| --- | --- | --- | --- |
| Cadastrar cliente no atendimento | Recepção, atendimento ou administrativo. | Editar condição comercial é permissão própria. | Sem acesso automático a dívida de outra unidade. |
| Reservar, entrar e lançar bebida | Recepção. | Alterar tarifa/desconto além da política exige aprovação. | Unidade pousada e estado vigente do documento. |
| Montar/preparar/entregar pedido | Atendimento/cozinha conforme ação. | Cancelar item já executado requer motivo e permissão específica. | Cozinha não recebe acesso bancário por preparar pedido. |
| Receber cobrança | Caixa/recepção/administrativo conforme unidade. | Estorno exige poder próprio ou aprovação vinculada. | Não permite trocar origem, unidade ou preço para contornar limite. |
| Contratar e reajustar empresa | Gestor ou administrativo habilitado. | Conceder crédito e exceção a limite/vigência são poderes distintos. | Preservar condições anteriores e cobrar somente realizado autorizado. |
| Registrar fornecimento | Atendimento/administrativo habilitado. | Corrigir registro fechado exige ajuste autorizado. | Não editar demonstrativo confirmado como cadastro comum. |
| Receber compra | Estoque/administrativo habilitado. | Aprovar divergência ou fornecedor novo conforme política. | Receber mercadoria não concede poder de pagar fornecedor. |
| Registrar produção/perda comum | Cozinha/estoque habilitado. | Ajuste de inventário e perda acima de limite configurado exigem poder específico. | Sem edição livre de saldo. Limites ainda precisam ser acordados. |
| Pagar, transferir e conferir conta | Administrativo/gestor habilitado. | Consultar resultado ou administrar conta são poderes próprios. | Permissão por conta/unidade e origem preservada. |
| Fechar turno | Responsável do turno. | Gestor habilitado pode fechar turno de outro responsável. | Contagem, divergência e aprovação registradas. |
| Consultar relatórios | Conforme domínio autorizado. | Consolidado exige acesso às unidades abrangidas. | Exportação verifica o mesmo escopo da consulta. |
| Gerir usuários/restaurar dados | Administrador explicitamente habilitado. | Sem aprovação operacional genérica para obter esses poderes. | Manter administrador ativo e histórico de ações. |

Para cinco funcionários, perfis com funções acumuladas são suficientes. Aprovação adicional serve para exceções com efeito relevante; não deve ser uma etapa obrigatória para cada bebida ou refeição comum.

## 7. Modelo conceitual e relacionamentos

Modelo de negócio, não esquema de implementação. Nomes de entidades são conceituais; tabelas, APIs, bibliotecas e migrações serão definidos somente depois da revisão.

### 7.1 Organização, pessoas e catálogo

| Entidade | Dados principais | Relações e limites |
| --- | --- | --- |
| UnidadeOperacional | Nome, tipo pousada/restaurante, situação, identidade cadastral opcional. | Origem de toda operação; separada de eventual titularidade jurídica. |
| Pessoa | ID estável, PF/PJ, nome, razão social/nome fantasia quando aplicável, documento opcional conforme rotina, contatos e endereço. | Pode ter vários papéis; CPF/CNPJ não é a chave técnica. |
| PapelPessoa | Cliente, fornecedor ou hóspede; situação e unidade de relacionamento. | Papel não duplica a pessoa; dados e histórico exibidos conforme autorização. |
| ContatoEmpresa | Nome, telefone/e-mail, finalidade. | Contato de cobrança/entrega, sem cadastro completo obrigatório de cada funcionário. |
| Item | Nome, tipo, unidade-base, categoria, código/barcode opcional, controle de lote e situação. | Ingrediente, embalagem, bebida, preparação ou serviço. |
| OfertaUnidade | Item, unidade operacional, vendável/comprável, preço padrão, estratégia de consumo. | Mesma bebida pode ter duas ofertas; saldo não pertence à oferta. |
| PrecoVigente | Oferta/categoria de quarto, cliente/contrato opcional, valor, unidade de cobrança, início e fim. | Sem vigências concorrentes de mesma prioridade; alteração não muda preço já aplicado. |
| Usuario | Identidade, autenticação e situação. | Acesso ao ERP; diferente de Pessoa e Funcionário. |
| VinculoAcesso | Usuário, ações e unidades permitidas. | Regras verificadas no servidor inclusive em relatórios e consultas por ID. |
| Funcionario | Nome, situação e condições de benefício. | Usuário relacionado é opcional; não é beneficiário de contrato de outra empresa. |

~~~mermaid
erDiagram
    PESSOA ||--o{ PAPEL_PESSOA : exerce
    UNIDADE ||--o{ PAPEL_PESSOA : atende
    PESSOA ||--o{ CONTATO_EMPRESA : possui
    ITEM ||--o{ OFERTA_UNIDADE : disponibilizado
    UNIDADE ||--o{ OFERTA_UNIDADE : oferece
    OFERTA_UNIDADE ||--o{ PRECO : tem
    PESSOA o|--o{ PRECO : acordo_cliente
    USUARIO ||--o{ VINCULO_ACESSO : recebe
    UNIDADE ||--o{ VINCULO_ACESSO : limita
~~~

A relação opcional Pessoa–Preço representa apenas preços específicos. O preço padrão não exige um cliente. Tarifas de quartos aparecem no diagrama de hospedagem.

### 7.2 Pousada

| Entidade | Dados principais | Relações e limites |
| --- | --- | --- |
| CategoriaQuarto | Nome, capacidade e tarifa-base por pessoa, com faixas de quantidade de hóspedes. | Uma categoria pode ter vários quartos; tarifa específica de quarto pode substituir a base. |
| TarifaHospedagem | Categoria/quarto, quantidade/faixa de hóspedes, preço por pessoa/noite e vigência. | Uma regra aplicável por prioridade e noite; sem faixas ambíguas nem mudança retroativa do preço acordado. |
| Quarto | Número, categoria, condição física e situação cadastral. | Não armazena a conta definitiva do hóspede. |
| BloqueioQuarto | Período, motivo e responsável. | Interfere na disponibilidade; tratamento de reservas conflitantes obrigatório. |
| Reserva | Código, pagador, contato, situação, origem opcional e condições acordadas. | Uma reserva pode conter vários quartos/períodos. |
| AcomodacaoReservada | Reserva, categoria/quarto, entrada, saída, ocupantes e preço acordado. | Intervalo sem sobreposição; atribuição de quarto compatível. |
| DiariaAcordada | Acomodação, data, quantidade de hóspedes cobrada, preço por pessoa, tarifa-base, ajuste e total acordado. | Total da noite = quantidade cobrada × preço por pessoa aplicável; mudanças de ocupação geram revisão explícita das noites afetadas. |
| Hospedagem | Acomodação, entrada/saída efetivas e situação. | Identidade da permanência, inclusive quando há troca de quarto. |
| OcupanteHospedagem | Hospedagem, pessoa e papel titular/acompanhante. | Mais de um ocupante; titular não é necessariamente pagador. |
| AlocacaoQuarto | Hospedagem, quarto e intervalo efetivo. | Registra troca sem reescrever histórico; um quarto por hospedagem simples em cada intervalo. |
| CobrancaHospedagem | Diária, bebida ou ajuste; data, quantidade, preço e origem. | Bebida da pousada tem item e origem de estoque; consumo do restaurante é apresentado por vínculo ao documento original, sem nova venda. |
| VinculoConsumoRestaurante | Hospedagem, pedido/itens do restaurante, valor direcionado e situação de cobrança. | Reúne cobranças na conta apresentada ao hóspede sem duplicar dívida, receita, baixa ou pagamento. |
| MovimentoCredito | Pessoa, unidade, geração/utilização/estorno, valor e referência. | Saldo calculado pelo histórico; não é campo editável. |

~~~mermaid
erDiagram
    UNIDADE ||--o{ QUARTO : possui
    CATEGORIA_QUARTO ||--o{ QUARTO : classifica
    CATEGORIA_QUARTO ||--o{ TARIFA : precifica
    QUARTO o|--o{ TARIFA : especifica
    QUARTO ||--o{ BLOQUEIO_QUARTO : bloqueado
    PESSOA ||--o{ RESERVA : paga
    RESERVA ||--|{ ACOMODACAO_RESERVADA : contem
    QUARTO o|--o{ ACOMODACAO_RESERVADA : atribuido
    ACOMODACAO_RESERVADA ||--|{ DIARIA_ACORDADA : precifica
    ACOMODACAO_RESERVADA ||--o| HOSPEDAGEM : origina
    HOSPEDAGEM ||--|{ OCUPANTE_HOSPEDAGEM : hospeda
    PESSOA ||--o{ OCUPANTE_HOSPEDAGEM : ocupa
    HOSPEDAGEM ||--|{ ALOCACAO_QUARTO : ocupa
    QUARTO ||--o{ ALOCACAO_QUARTO : recebe
    HOSPEDAGEM ||--o{ COBRANCA_HOSPEDAGEM : gera
    ITEM o|--o{ COBRANCA_HOSPEDAGEM : bebida
    HOSPEDAGEM ||--o{ VINCULO_CONSUMO_RESTAURANTE : agrupa
    PEDIDO ||--o{ VINCULO_CONSUMO_RESTAURANTE : origem_restaurante
    PESSOA ||--o{ MOVIMENTO_CREDITO : possui
~~~

Adiantamentos podem existir antes da hospedagem, vinculados à reserva e ao pagador. Não são inferidos do valor da reserva.

**Tarifa por ocupação:** a configuração informa preço por pessoa para uma quantidade/faixa de hóspedes, por categoria e, quando necessário, por quarto específico. Exemplo ilustrativo: quarto A com 1 hóspede a R$ 120/pessoa/noite; com 2 hóspedes a R$ 100/pessoa/noite, total R$ 200 por noite. O preço é sugerido, confirmado e preservado por noite. Crianças, café incluído e valores reais são detalhes configuráveis para revisar no protótipo, não novos bloqueios de arquitetura.

**Saída empresarial:** quarto e hospedagem podem ser encerrados enquanto obrigação da empresa permanece aberta. Titular/hóspedes, empresa pagadora, vencimento, saldo e cobranças ficam consultáveis após a saída. Não marcar como recebido nem criar novo título ao tentar cobrar novamente.

**Restaurante na conta:** lançar na hospedagem é escolher onde apresentar/cobrar o pedido original, não transformar refeição em venda da pousada. Estoque e receita continuam no restaurante; recebimento conjunto é distribuído às obrigações de origem. Com caixas/contas separados, o protótipo deve evidenciar o valor recebido em nome da outra unidade e o acerto interno, sem inventar uma segunda receita. Esse acerto operacional será refinado após a resposta sobre dinheiro compartilhado/separado.

### 7.3 Restaurante e empresas

| Entidade | Dados principais | Relações e limites |
| --- | --- | --- |
| Mesa | Número, capacidade e disponibilidade. | Relação opcional com pedido; não é requisito para balcão ou empresa. |
| Pedido | Canal, cliente/pagador opcional, mesa opcional, previsão, situação e responsável. | Unidade restaurante; situação operacional distinta da financeira. |
| ItemPedido | Oferta, descrição preservada, quantidade, unidade, preço aplicado, ajuste e situação. | Quantidade decimal para peso; não recebe “kg” em campo inteiro. |
| EntregaPedido | Pedido/itens, quantidade entregue, data, retirada/entrega e responsável. | Permite entrega parcial; não implica pagamento. |
| ContratoEmpresa | Cliente PJ, vigência, modalidade de cobrança, período de fechamento, vencimento e situação. | Pertence ao restaurante; prevê X refeições para Y funcionários por dia e não gera receita por mera assinatura. |
| ItemContrato | Item/serviço, preço acordado, unidade, vigência e condições. | Define o que pode ser fornecido e cobrado. |
| RegraDiariaContrato | Quantidade X, funcionários Y, base de X (grupo ou por funcionário), dias de atendimento, tipos/horários de refeição e vigência. | Define compromisso diário e planejamento; quantidade contratada é distinta do realizado e do cobrável. |
| FornecimentoEmpresa | Contrato, data, refeição, quantidade, preço preservado, origem e beneficiário opcional. | Registro confirmado de entrega/consumo; pode vir de item de pedido ou lançamento diário. |
| AjusteFornecimento | Referência, diferença de quantidade/valor, motivo e aprovação. | Corrige sem apagar consumo já confirmado/cobrado. |
| FechamentoEmpresa | Contrato, período, demonstrativo, situação e total. | Seleciona fornecimentos elegíveis ainda não cobrados. |
| ItemFechamento | Fornecimento/ajuste ou cobrança fixa do período, descrição e valor. | Cada parcela fornecida é cobrada no máximo uma vez; fixos têm chave de período. |
| ConsumoFuncionario | Funcionário, unidade, itens, benefício/cobrado, data e responsável. | Baixa física e custo, sem inventar venda em benefício gratuito. |

~~~mermaid
erDiagram
    PESSOA o|--o{ PEDIDO : paga
    MESA o|--o{ PEDIDO : atende
    PEDIDO ||--|{ ITEM_PEDIDO : contem
    OFERTA_UNIDADE ||--o{ ITEM_PEDIDO : vendido
    PEDIDO ||--o{ ENTREGA_PEDIDO : realizado
    PESSOA ||--o{ CONTRATO_EMPRESA : contrata
    CONTRATO_EMPRESA ||--|{ ITEM_CONTRATO : estabelece
    CONTRATO_EMPRESA ||--|{ REGRA_DIARIA_CONTRATO : programa
    CONTRATO_EMPRESA ||--o{ FORNECIMENTO_EMPRESA : utilizado
    ITEM_PEDIDO o|--o{ FORNECIMENTO_EMPRESA : origem_opcional
    FORNECIMENTO_EMPRESA ||--o{ AJUSTE_FORNECIMENTO : corrigido
    CONTRATO_EMPRESA ||--o{ FECHAMENTO_EMPRESA : fecha
    FECHAMENTO_EMPRESA ||--|{ ITEM_FECHAMENTO : discrimina
    FORNECIMENTO_EMPRESA o|--o{ ITEM_FECHAMENTO : cobrado
~~~

O diagrama mostra relações possíveis, não todas as restrições. No modelo lógico, é obrigatório impedir duas cobranças para a mesma quantidade fornecida. Um registro não pode ser cobrado simultaneamente como venda individual e como fornecimento empresarial. Cobrança fixa tem origem no contrato/período, não em uma entrega fictícia.

#### Quantidade diária contratada

O acordo confirmado é “X refeições para Y funcionários por dia”. A ficha deve registrar os dois valores, e não apenas uma observação livre. O significado de X será selecionado explicitamente:

- **X refeições no total para o grupo por dia:** compromisso diário = X; Y indica o grupo atendido. Não multiplicar X por Y.
- **X refeições por funcionário por dia:** compromisso diário = X × Y, com tipos de refeição e dias de atendimento definidos.

O modo efetivamente usado pelo cliente ainda precisa ser confirmado. O sistema não deve adivinhar essa base. Por exemplo, 40 refeições para 20 funcionários no total são 40 por dia; 2 refeições por funcionário para 20 funcionários também são 40 por dia, mas os parâmetros e os limites são diferentes.

Mudança de X, Y, dias atendidos ou preço tem vigência e conserva o acordo anterior. A agenda diária mostra contratado/previsto, efetivamente fornecido, diferença e eventual excedente. O número Y não obriga cadastrar dados pessoais de todos os funcionários: lista nominativa e limite individual continuam condicionados à forma de comprovação.

Quantidade prevista não prova consumo. Cobrar somente realizado, cobrar quantidade reservada mesmo com faltas, ou cobrar uma parcela fixa são políticas diferentes e ainda precisam ser acordadas. Excedente precisa de autorização e preço definido; não será aprovado ou cobrado silenciosamente.

### 7.4 Compras, estoque e cozinha

| Entidade | Dados principais | Relações e limites |
| --- | --- | --- |
| LocalEstoque | Nome, unidade, finalidade e situação. | Inicialmente dois locais, com propriedade operacional definida. |
| SaldoItemLocal | Item, local, saldo disponível/reservado quando aplicável, mínimo e custo médio. | Visão reconciliável com movimentos; não editada diretamente. |
| Lote | Item, código interno/fornecedor, entrada/preparo e validade. | Lote interno pode suprir falta de código; nunca inventa validade. |
| SaldoLoteLocal | Lote, local, quantidade e bloqueio. | Um mesmo lote pode ser distribuído entre locais por transferência. |
| MovimentoEstoque | Item, lote quando exigido, local, quantidade, custo, data, origem e responsável. | Entrada, consumo, produção, perda, transferência ou compensação. |
| Compra | Fornecedor, unidade, data, referência opcional, situação e condições financeiras. | Obrigação financeira separada de quantidade recebida. |
| ItemCompra | Item, quantidade/unidade de compra, conversão, custo, descontos e destino. | Conversão preservada no documento. |
| RecebimentoCompra | Compra, data e itens efetivamente recebidos. | Um ou vários recebimentos; não cria nova dívida em cada recebimento parcial. |
| ItemRecebido | Linha de compra, quantidade aceita/recusada, lote, validade e local. | Diferencia mercadoria entregue de mercadoria utilizável. |
| DevolucaoCompra | Recebimento, quantidade/lote, motivo e efeito financeiro acordado. | Saída física e crédito/reembolso do fornecedor são eventos distintos. |
| Inventario | Local, data de corte, situação, contagens e responsável. | Ajuste aprovado sobre saldo no corte; movimentos posteriores não são perdidos. |
| TransferenciaEstoque | Origem, destino, itens/lotes, custo e responsável. | Atômica para movimento físico imediato; entre titulares jurídicos depende de confirmação. |
| FichaTecnica | Preparação, versão, rendimento, ingredientes e instruções. | Referência estimada; histórico de produção preserva versão utilizada. |
| IngredienteFicha | Item, quantidade-base e rendimento/perda técnica quando configurado. | Conversões compatíveis; embalagem pode compor custo. |
| Producao | Preparação, data, saída real, ingredientes utilizados, custo e responsável. | Gera saldo preparado quando usado o modo “produção em lote”. |
| ConsumoProducao | Produção, item, lote/local, quantidade real e custo preservado. | Ingredientes usados uma única vez. |
| Perda | Local/lote/item, quantidade, motivo, data e custo. | Descarte, deterioração ou quebra; não é devolução de venda. |

~~~mermaid
erDiagram
    UNIDADE ||--o{ LOCAL_ESTOQUE : possui
    ITEM ||--o{ LOTE : identificado
    LOTE ||--o{ SALDO_LOTE_LOCAL : distribuido
    LOCAL_ESTOQUE ||--o{ SALDO_LOTE_LOCAL : guarda
    ITEM ||--o{ MOVIMENTO_ESTOQUE : movimentado
    LOCAL_ESTOQUE ||--o{ MOVIMENTO_ESTOQUE : recebe
    LOTE o|--o{ MOVIMENTO_ESTOQUE : rastreia
    PESSOA ||--o{ COMPRA : fornece
    COMPRA ||--|{ ITEM_COMPRA : contem
    COMPRA ||--o{ RECEBIMENTO_COMPRA : recebido
    RECEBIMENTO_COMPRA ||--|{ ITEM_RECEBIDO : confere
    ITEM_COMPRA ||--o{ ITEM_RECEBIDO : corresponde
    ITEM_RECEBIDO ||--o{ MOVIMENTO_ESTOQUE : gera
    ITEM ||--o{ FICHA_TECNICA : preparado
    FICHA_TECNICA ||--|{ INGREDIENTE_FICHA : requer
    FICHA_TECNICA ||--o{ PRODUCAO : orienta
    PRODUCAO ||--|{ CONSUMO_PRODUCAO : utiliza
    PRODUCAO o|--o{ LOTE : produz
~~~

Para itens sem rastreamento por lote, o saldo é por item/local. Para perecíveis sujeitos a validade, rastreamento é obrigatório. O sistema não determina prazo seguro de alimento preparado: a validade é informada segundo o procedimento da operação.

### 7.5 Financeiro

| Entidade | Dados principais | Relações e limites |
| --- | --- | --- |
| ObrigacaoFinanceira | Tipo receber/pagar, pessoa, unidade, origem, valor e condição. | Total do documento comercial; pode ter parcelas. Não é saldo de banco. |
| ParcelaObrigacao | Valor, vencimento e saldo em aberto. | Situação derivada das alocações; atraso não altera o valor sem ajuste autorizado. |
| Liquidacao | Recebimento/pagamento/crédito, data, valor, pagador/beneficiário e responsável. | Pode ter várias formas de pagamento e várias parcelas atendidas. |
| MeioLiquidacao | Forma, valor, destino e referência de comprovante opcional. | Dinheiro, PIX, cartão ou crédito interno; comportamento financeiro distinto. |
| AlocacaoLiquidacao | Liquidação, parcela e valor aplicado. | Relação muitos-para-muitos; não permite alocar mais que saldo/valor disponível. |
| ContaFinanceira | Dinheiro físico ou banco; titularidade, saldo inicial conciliado e situação. | Conta compartilhada não mistura a unidade de origem do movimento. |
| TurnoCaixa | Caixa físico, responsável, início/fim, fundo, contagem e divergência. | Uma sessão aberta por caixa físico; unidade permitida definida. |
| MovimentoConta | Conta, data, entrada/saída, valor, unidade de origem e referência. | Fonte de saldo financeiro; transferência não é receita/despesa. |
| RecebivelCartao | Origem, valor bruto, taxa prevista, líquido e data prevista. | Crédito não vira saldo bancário disponível ao registrar a venda. |
| RepasseCartao | Recebíveis liquidados, taxa real, valor e conta de destino. | Valor recebido no banco conciliado com os recebíveis. |
| LinhaExtrato | Conta, data, identificação, descrição e valor observado. | Importação CSV ou lançamento de conferência; não cria receita duplicada. |
| Conciliacao | Movimento(s) interno(s), linha(s) de extrato, diferença e responsável. | Permite conferir agregações como repasse de várias vendas. |
| RegraRecorrencia | Pessoa, unidade, categoria, valor previsto, frequência e período. | Gera obrigações previstas; nunca marca pagamento automaticamente. |
| RateioGerencial | Documento comum, unidades e percentuais/valores. | Opcional; soma igual ao total. Não gera uma segunda saída bancária. |

~~~mermaid
erDiagram
    UNIDADE ||--o{ OBRIGACAO : pertence
    PESSOA ||--o{ OBRIGACAO : parte
    OBRIGACAO ||--|{ PARCELA : divide
    PARCELA ||--o{ ALOCACAO : quitada
    LIQUIDACAO ||--o{ ALOCACAO : aplica
    LIQUIDACAO ||--|{ MEIO_LIQUIDACAO : compoe
    CONTA_FINANCEIRA ||--o{ MOVIMENTO_CONTA : movimenta
    MEIO_LIQUIDACAO ||--o{ MOVIMENTO_CONTA : gera_quando_efetivo
    CONTA_FINANCEIRA ||--o{ TURNO_CAIXA : abre
    TURNO_CAIXA o|--o{ MOVIMENTO_CONTA : identifica_dinheiro
    MEIO_LIQUIDACAO ||--o{ RECEBIVEL_CARTAO : agenda
    REPASSE_CARTAO o|--|{ RECEBIVEL_CARTAO : liquida
    CONTA_FINANCEIRA ||--o{ LINHA_EXTRATO : confere
    LINHA_EXTRATO ||--o{ CONCILIACAO : associada
    MOVIMENTO_CONTA ||--o{ CONCILIACAO : conferido
~~~

Origem de uma obrigação é tipada e rastreável: compra, despesa, pedido, cobrança da hospedagem ou fechamento de empresa. A mesma origem não pode gerar uma segunda obrigação indevida. As relações entre documentos comerciais e obrigações não foram desenhadas em todos os diagramas para manter a leitura; são obrigatórias no modelo lógico.

Adiantamento ainda não alocado permanece identificado pelo pagador e unidade. Crédito interno quita obrigação por alocação, sem gerar entrada bancária. Cancelamento devolve ao meio correto ou gera crédito autorizado, preservando sua origem.

Um recebível de cartão pode ainda não ter repasse; um lote comprado não precisa ter produção de origem. Essas relações opcionais estão representadas nos diagramas. Operações com entrega imediata podem registrar pedido, entrega e cobrança num único comando do usuário, preservando suas identidades; separar conceitos não exige obrigar o caixa a passar por três telas.

### 7.6 Pontos deliberados de consumo e cobrança

| Rotina | Evento físico | Evento comercial | Evento financeiro |
| --- | --- | --- | --- |
| Bebida da pousada | Lançamento confirmado de bebida entregue ao hóspede baixa lote/local da pousada. | Linha de cobrança da hospedagem conserva preço. | Recebimento quita cobrança; não baixa a bebida novamente. |
| Bebida do restaurante | Entrega/consumo confirmado baixa lote/local do restaurante. | Item de pedido é faturado ao cliente/pagador. | Liquidação/repasses conforme meio, sem nova baixa física. |
| Marmita produzida em lote | Produção baixa ingredientes; entrega baixa marmita pronta e embalagem conforme composição definida. | Quantidade entregue é base da venda ou fornecimento contratual. | Venda avulsa ou fechamento gera cobrança; pagamento quita. |
| Preparação sob demanda | Confirmação do preparo baixa ingredientes da receita; entrega não repete consumo. | Item entregue é base comercial. | Cobrança e pagamento seguem condição acordada. |
| Buffet em produção coletiva | Produção baixa ingredientes; abastecimento e fechamento da cozinha registram destinação do preparado e sobra/perda. | Buffet livre é cobrado por pessoa/refeição; buffet por quilo usa peso líquido × preço/kg. | Recebimento quita venda; não tenta reconstruir ingredientes do prato. |
| Empresa com registro diário | Registrar quantidade entregue confirma o realizado; ligação com produção/estoque ou pedido evita repetição. | Fornecimento é base do fechamento variável. | Fechamento gera título; recebimento não gera outra venda ou baixa. |

Para marmitas, embalagem consumida na produção pertence ao custo de produção; embalagem colocada apenas na entrega é baixada nessa etapa. Não pode aparecer como consumo automático nas duas. O mesmo vale para bebidas e complementos incluídos em um preço combinado.

No buffet, o fechamento de cozinha deve registrar o que saiu da produção para consumo, perda ou sobra reaproveitável segundo o procedimento real. O sistema não atribui composição ao prato do cliente. O registro físico coletivo é vinculado ao dia/serviço; as vendas comerciais não geram uma segunda retirada dos mesmos alimentos.

Em compra com recebimento parcial, a obrigação vem do documento/condição acordada com fornecedor, não da soma de cliques em “receber”. Se a cobrança cobrir somente o recebido, seus itens precisam apontar as quantidades correspondentes. Na rotina simples “receber e registrar a compra”, a confirmação pode gerar todos os vínculos de uma vez.

### 7.7 Identidade, histórico e integridade

- IDs estáveis para pessoas e documentos; documento, nome e número de quarto são atributos.
- Quantidades admitem frações compatíveis com unidade; dinheiro tem precisão decimal e regra explícita de arredondamento.
- Referências por ID e restrições no banco; texto preservado serve de retrato histórico, não substitui vínculo.
- Dados confirmados preservam nome/descrição, preço, unidade, conversão e custo utilizados.
- Cadastros com uso histórico são inativados, não apagados em cascata.
- Auditoria acompanha unidade, documento, usuário, aprovador, motivo e antes/depois permitido.
- “Pago”, “saldo disponível” e “total consumido” derivam dos movimentos relacionados; não são marcadores livres.
- Consulta por ID verifica unidade e permissão, mesmo que o documento não apareça no menu do usuário.

## 8. Requisitos funcionais

**N — núcleo necessário:** cobre rotina confirmada ou integridade essencial.

**C — condicional:** entra quando a operação correspondente for confirmada.

**E — evolução:** útil posteriormente, sem impedir os ciclos básicos.

Prioridade não indica uma ordem de implementação. Nenhuma lista abaixo autoriza começar a codificar.

### 8.1 Organização, cadastros e preços

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| ORG-01 | N | Toda venda, reserva, compra, despesa, cobrança, baixa e relatório identifica a unidade operacional. |
| ORG-02 | N | Pousada e restaurante têm saldos separados; cadastro compartilhado não permite usar saldo de outra unidade. |
| ORG-03 | N | Usuário escolhe somente unidades autorizadas; lançamentos mostram a unidade antes de confirmar. |
| CAD-01 | N | Cadastrar PF/PJ, cliente/fornecedor/hóspede, contatos, situação e endereço quando necessário. |
| CAD-02 | N | Buscar por nome, telefone e documento; impedir duplicação do mesmo documento normalizado, com tratamento de cadastros legados. |
| CAD-03 | N | Atendimento anônimo do restaurante não exige CPF; venda a prazo/contrato exige cliente identificado. Hospedagem tem política própria de identificação. |
| CAD-04 | N | Consultar CNPJ sob demanda e confirmar dados antes de salvar; falha da API permite cadastro manual. |
| CAD-05 | N | CNPJ é textual e comporta formato numérico e alfanumérico; CPF segue sua própria validação. |
| CAD-06 | N | Cadastro rápido reutiliza a mesma identidade do cadastro completo; inativação mantém histórico. |
| CAD-07 | N | Ficha da pessoa mostra operações relacionadas permitidas, sem expor histórico de unidade não autorizada. |
| CAD-08 | N | Item registra tipo, unidade-base, controle de estoque/lote, categoria e possibilidade de compra/venda. |
| PRE-01 | N | Cadastrar preço padrão de bebida, marmita, buffet livre por pessoa/refeição, buffet por quilo por kg e diária/categoria de quarto. |
| PRE-02 | N | Preço específico de contrato vigente prevalece sobre padrão; exceção autorizada é identificada com motivo. |
| PRE-03 | N | Preço e regra aplicados ficam preservados na linha de operação, mesmo após reajuste de cadastro. |
| PRE-04 | N | Descontos consideram efeito acumulado; ultrapassar limite exige aprovação específica e auditada. |
| PRE-05 | N | Configurar preço por pessoa/noite por quarto/categoria e quantidade/faixa de hóspedes; calcular total com ocupação confirmada e preservar regra por noite. Tarifas sazonais são evolução configurável. |
| PRE-06 | N | Mudança de preço do fornecedor não altera automaticamente preço de venda. Mostrar custo e sugerir revisão sem aplicar silenciosamente. |

### 8.2 Pousada

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| HOS-01 | N | Mapa mostra condição física; consulta por período mostra disponibilidade e conflitos. |
| HOS-02 | N | Reserva informa pagador, contato, período, quartos/categorias e valor sugerido por diária. |
| HOS-03 | N | Confirmar reserva individual/grupo sem sobreposição; grupo é confirmado integralmente ou recusado. |
| HOS-04 | N | Check-in registra ocupantes e abre hospedagem ligada à reserva; atendimento sem reserva gera origem consistente. |
| HOS-05 | N | Lançar bebidas de catálogo com preço da pousada e baixa do estoque da pousada no consumo confirmado. |
| HOS-06 | N | Extrato da hospedagem mostra diárias, bebidas, ajustes, adiantamentos, recebimentos e saldo. |
| HOS-07 | N | Troca de quarto conserva hospedagem, conta e histórico; verifica capacidade e disponibilidade de destino. |
| HOS-08 | N | Recebimentos parciais são permitidos; check-out exige quitação ou condição empresarial a prazo identificada e autorizada. Em ambos, quarto passa para limpeza; dívida a prazo permanece aberta. |
| HOS-09 | N | Cancelamento e no-show preservam motivo; reserva paga admite multa/reembolso/crédito com autorização prevista. |
| HOS-10 | N | Crédito é movimentado por operações autorizadas e pertence ao pagador/unidade definidos; sem edição direta de saldo. |
| HOS-11 | N | Cobrança empresarial posterior ao check-out mantém conta a receber aberta, empresa pagadora, vencimento, saldo e acompanhamento de cobrança vinculados à hospedagem encerrada. |
| HOS-12 | N | Restaurante permite pagar diretamente ou lançar na conta da hospedagem ativa, preservando unidade de origem, dívida única, estoque e alocação dos recebimentos. |
| HOS-13 | N | Extrato agrupado da hospedagem distingue diárias/bebidas da pousada e consumos do restaurante; cobrança e recebimento conjunto não duplicam receita nem baixa física. |

### 8.3 Restaurante: salão, balcão, buffet e marmitas

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| VEN-01 | N | Pedido pode existir sem mesa; distingue salão, balcão, marmita e empresa. |
| VEN-02 | N | Pedido tem estado de preparo/entrega separado de pagamento e cobrança. |
| VEN-03 | N | Marmita tem tamanho/variante, preço padrão, observação e modalidade retirada/entrega quando usada. |
| VEN-04 | N | Oferecer buffet livre e buffet por quilo, com modalidade e preço padrão próprios: livre por pessoa/refeição; por quilo por peso líquido × preço/kg. |
| VEN-05 | N | No buffet por quilo, informar peso bruto/tara/líquido ou peso líquido medido; não descontar tara duas vezes. No livre, não exigir peso. |
| VEN-06 | N | Bebidas e embalagens vendidas podem coexistir com refeição por peso no mesmo pedido. |
| VEN-07 | N | Adicionar, corrigir ou cancelar item preservando situação de preparo, motivo e efeito de estoque correto. |
| VEN-08 | N | Receber com mais de um meio de pagamento, calcular troco somente sobre dinheiro e impedir quitação duplicada. |
| VEN-09 | N | Cliente identificado pode comprar a prazo quando autorizado; fechamento gera obrigação em vez de recebimento fictício. |
| VEN-10 | N | Cancelamento financeiro não repõe alimento consumido; devolução física utilizável é decisão separada. |
| VEN-11 | N | Histórico apresenta pedido, entrega, cobrança, pagamentos e saldo com vínculos. |
| VEN-12 | C | Dividir conta por valor ou itens quando a rotina do salão exigir; soma das partes conserva total e desconto. |
| VEN-13 | C | Transferir/mesclar comandas com versão atual e auditoria quando necessário ao salão. |
| VEN-14 | E | Integração de balança/impressora pode complementar o registro manual, sem ser condição inicial. |
| VEN-15 | N | Buffet livre registra quantidade de pessoas/refeições e preço fixo; bebidas, embalagem e extras são separados ou explicitamente incluídos na oferta. |
| VEN-16 | N | Modalidade de buffet fica preservada no item vendido; mudar preço ou modalidade do cadastro não altera vendas anteriores. |

Taxa de entrega, embalagem cobrada à parte e complementos são linhas comerciais identificadas, com tratamento de estoque somente quando representam item físico. Taxa de serviço do salão é condicional à rotina e precisa de decisão própria; não será ativada automaticamente.

### 8.4 Contratos e fornecimentos a empresas

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| EMP-01 | N | Contrato identifica empresa pagadora, contato, vigência, X refeições, Y funcionários, base da quantidade diária, itens/preços, dias atendidos, fechamento e prazo de pagamento. |
| EMP-02 | N | Registrar refeições efetivamente entregues/consumidas por data, tipo e quantidade; beneficiário é opcional conforme controle acordado. |
| EMP-03 | N | Preço é o válido e acordado na data do fornecimento; assinatura de contrato não movimenta caixa nem estoque. |
| EMP-04 | N | Fornecimento pode nascer de pedido ou lançamento diário, com exclusão mútua para evitar registro duplo. |
| EMP-05 | N | Fechamento seleciona somente registros elegíveis ainda não cobrados e gera demonstrativo não fiscal e obrigação financeira. |
| EMP-06 | N | Repetir fechamento do mesmo período não duplica cobrança; concorrência é tratada sem seleção repetida. |
| EMP-07 | N | Após fechamento, correção gera ajuste rastreável; demonstrativo anterior fica preservado ou formalmente substituído. |
| EMP-08 | N | Recebimento parcial ou único para vários fechamentos baixa saldos e conserva distribuição. |
| EMP-09 | N | Contrato suspenso/vencido impede novos fornecimentos contratuais; exceção exige ação explícita autorizada. |
| EMP-10 | C | Cobrança de quantidade reservada/não consumida, mínimo garantido ou parcela fixa somente após confirmar a política comercial; quantidade diária contratada não implica cobrança automática. |
| EMP-11 | C | Lista de beneficiários, matrícula e limite por pessoa somente quando exigidos pelo cliente empresarial. |
| EMP-12 | N | Agenda mostra demanda prevista separada de fornecimento confirmado; previsão não é cobrança. |
| EMP-13 | N | A regra diária distingue X total para o grupo de X por funcionário; calcula compromisso diário sem multiplicação implícita e mostra Y funcionários. |
| EMP-14 | N | Registrar contratado/previsto, fornecido e diferença por data/tipo de refeição; separar ausência, cancelamento da previsão e excedente. |
| EMP-15 | N | Alterar X, Y, dias atendidos ou preço com vigência explícita, preservando planejamento e fornecimentos anteriores. |
| EMP-16 | N | Excedente exige regra/preço e autorização definidos; falta de consumo não gera entrega fictícia para completar o contrato. |

### 8.5 Compras e fornecedores

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| COM-01 | N | Receber compra em uma tela com fornecedor, unidade, itens, destino, custo, lote/validade e condição financeira. |
| COM-02 | N | Confirmação cria recebimento, entradas e obrigação vinculada sem duplicação; pagamento à vista é etapa de liquidação. |
| COM-03 | N | Unidade de compra pode diferir da unidade-base, com conversão explícita preservada; embalagem não é confundida com ingrediente. |
| COM-04 | N | Compra aceita desconto/frete com regra de distribuição e conserva o total financeiro em centavos. |
| COM-05 | C | Pedido prévio e recebimento parcial são oferecidos se a rotina usar encomendas; saldo a receber fica separado de dívida. |
| COM-06 | N | Conferência informa divergências e produtos recusados; quantidade recusada não entra no saldo utilizável. |
| COM-07 | N | Devolução identifica lote recebido e acerto com fornecedor; não apaga compra nem presume reembolso imediato. |
| COM-08 | N | Serviço e gasto sem estoque podem ser lançados como despesa; compra de mercadoria não exige segunda digitação de despesa. |
| COM-09 | N | Histórico de fornecedor mostra itens, preços, recebimentos, dívida e pagamentos. |

### 8.6 Estoque e cozinha

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| EST-01 | N | Saldos separados por item/local, e por lote quando rastreado; saldo utilizável exclui vencidos/bloqueados. |
| EST-02 | N | Entrada de perecível exige lote interno/fornecedor e validade conforme política do item. |
| EST-03 | N | Saída sugere lote válido de vencimento mais próximo; vencido não pode ser vendido/usado. |
| EST-04 | N | Baixa física ocorre uma vez na confirmação de consumo/entrega, não novamente no recebimento do dinheiro. |
| EST-05 | N | Pousada aceita somente bebidas no seu estoque operacional; ingrediente do restaurante não aparece como saldo da pousada. |
| EST-06 | N | Ajustes, perdas e consumo interno têm quantidade, motivo e responsável; saldo não é sobrescrito livremente. |
| EST-07 | N | Inventário compara contagem e saldo no corte; aprovação gera diferença rastreável sem perder movimentos posteriores. |
| EST-08 | C | Transferência entre unidades exige operação explícita e preserva quantidade, lote e custo; estrutura jurídica precisa permitir o fluxo adotado. |
| EST-09 | N | Alertas de mínimo e validade mostram item/local/lote e abrem a tarefa correspondente. |
| EST-10 | N | Saldo insuficiente bloqueia operação concorrente; divergência física se resolve por ajuste autorizado, não estoque negativo silencioso. |
| COZ-01 | N | Ficha técnica relaciona preparação a ingredientes, unidade e rendimento; preço de venda permanece separado de custo. |
| COZ-02 | N | Produção registra saída real e consumo, com custo e versão da ficha preservados. |
| COZ-03 | N | Preparação em lote gera saldo preparado rastreado e baixa ingredientes uma vez; venda baixa a preparação. |
| COZ-04 | C | Preparação sob demanda pode baixar receita na confirmação do preparo; nunca acumula essa baixa com produção em lote do mesmo item. |
| COZ-05 | N | Buffet registra produção/consumo e sobras/perdas; peso do prato não gera composição fictícia de ingredientes. |
| COZ-06 | N | Embalagens e bebidas têm controle adequado à retirada/entrega; custo de marmita considera embalagem quando consumida. |
| COZ-07 | N | Consumo de funcionário separa benefício gratuito de venda/valor cobrado e respeita limite operacional. |
| COZ-08 | N | Validade de preparação é informada pela operação; sistema alerta e bloqueia uso vencido, sem definir prazo sanitário automático. |

### 8.7 Financeiro e gestão

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| FIN-01 | N | Contas a pagar/receber têm pessoa, unidade, origem, valor, parcelas e vencimento. |
| FIN-02 | N | Pagamentos parciais alocam valor às parcelas; recebido/pago e saldo são derivados do histórico. |
| FIN-03 | N | Adiantamentos e crédito interno conservam origem e saldo; utilização não gera segunda receita de caixa. |
| FIN-04 | N | Dinheiro exige turno aberto no caixa físico; PIX registra entrada na conta definida e comprovante opcional. |
| FIN-05 | N | Cartão gera recebível com taxa/data prevista; entrada bancária acontece no repasse registrado. |
| FIN-06 | N | Abertura, sangria, suprimento e fechamento de caixa identificam responsável, valor e origem/destino. |
| FIN-07 | N | Fechamento compara contagem física com movimentos do turno; divergência é registrada, não escondida por ajuste de fundo. |
| FIN-08 | N | Transferência entre contas conserva total financeiro e não é classificada como venda/despesa. |
| FIN-09 | N | Extrato interno distingue previsto e efetivo; conferência manual pode associar movimento ao extrato observado. |
| FIN-10 | E | Importar extrato CSV com prévia e proteção contra duplicação; integração bancária automática fica fora desta versão. |
| FIN-11 | N | Recorrência gera obrigação prevista uma vez por período, nunca um pagamento automático. |
| FIN-12 | N | Fluxo projetado considera saldo disponível, parcelas e repasses previstos com data; contratos futuros não realizados aparecem como estimativa separada. |
| FIN-13 | N | Estornos preservam origem, limite do valor já recebido/pago e autorização; crédito e devolução física não são confundidos. |
| FIN-14 | C | Despesa comum pode ter rateio explícito entre unidades; soma conserva o total e gera uma única saída de dinheiro. |
| REL-01 | N | Relatórios distinguem vendido/prestado, cobrado, recebido, custo e saldo disponível. |
| REL-02 | N | Restaurante inclui salão, balcão, marmitas e empresas sem contar fornecimento e fechamento duas vezes. |
| REL-03 | N | Pousada mostra ocupação, diárias acordadas/prestadas, bebidas e saldos pendentes. |
| REL-04 | N | Estoque mostra saldos, valor, mínimos, lotes próximos do vencimento, perdas e movimentos por unidade. |
| REL-05 | N | Resultado gerencial por unidade separa mercadoria comprada de custo consumido; consolidado elimina transferências internas. |
| REL-06 | N | Exportação de demonstrativo/relatório conserva filtros, período, unidade, totais e identificação de documento não fiscal. |
| REL-07 | N | Cada total oferece detalhamento até sua origem; resultado estimado identifica dados/fichas ausentes. |

## 9. Especificação das principais telas

As fichas abaixo definem comportamento, não uma nova estética. Cada tela deve ter ação principal, campos mínimos, dados complementares, consequência e exceções compreensíveis.

### T01 — Início e contexto

- **Objetivo:** iniciar o trabalho com tarefas relevantes ao perfil.
- **Exibir:** unidade ativa, turno, conexão; chegadas/saídas para recepção; pedidos pendentes para restaurante; vencimentos e alertas para gestor.
- **Ações:** abrir tarefa e iniciar operação frequente.
- **Estados:** carregando, atualizado, dados desatualizados, sem permissão, ambiente demo.
- **Regra:** consolidação gerencial não vira unidade padrão de lançamento.
- **Aceitação:** operador do restaurante não vê receita ou cadastro privado da pousada.

### T02 — Clientes, hóspedes e fornecedores

- **Objetivo:** localizar pessoa existente antes de cadastrar outra.
- **Obrigatórios:** tipo, nome e papel; identificação/documento conforme operação.
- **Complementares:** contatos, endereço, razão social, nome fantasia, observação e condição comercial.
- **Ações:** buscar, cadastrar rápido, abrir ficha, consultar CNPJ, inativar; papéis exibidos sem duplicar identidade.
- **Consulta CNPJ:** carregando, encontrado, não encontrado, inválido ou indisponível; mostrar campos retornados e pedir conferência. Não sobrescrever dados locais sem escolha.
- **Efeito:** atualizar cadastro; nenhum movimento financeiro.
- **Aceitação:** empresa pagadora pode ser selecionada em contrato, cobrança e reserva; campo de contato não cria login.

### T03 — Itens, cardápio e preços

- **Objetivo:** separar o que é comprado, produzido, vendido e prestado.
- **Obrigatórios:** nome, tipo, unidade-base e unidades em que é usado; preço somente para oferta vendável.
- **Complementares:** barcode, categoria, conversão de caixa/pacote, mínimo, lote/validade, receita e preparo.
- **Regras:** ingrediente não precisa de preço de venda; diária não precisa de estoque; validade pertence a entrada/lote.
- **Ações:** definir preço padrão, preço acordado, vigência e inativação.
- **Aceitação:** refrigerante existe uma vez no catálogo, com duas ofertas e dois saldos; arroz pode existir apenas como ingrediente.

### T04 — Quartos, tarifas e disponibilidade

- **Objetivo:** saber o que pode ser reservado e o que está pronto para ocupar.
- **Obrigatórios do quarto:** número, categoria, capacidade e situação.
- **Tarifa:** preço por pessoa/noite por quarto/categoria, conforme quantidade/faixa de hóspedes; mostrar preço individual e total da noite.
- **Exibir:** período consultado, disponibilidade e bloqueios; condição livre/ocupado/limpeza/manutenção.
- **Regra:** um quarto em limpeza hoje pode ter reserva futura; isso não autoriza check-in antes da liberação.
- **Aceitação:** impedir quarto com capacidade insuficiente ou sobreposição no período; duas pessoas com tarifa R$ 100/pessoa geram R$ 200/noite sem aplicar tarifa de ocupação individual.

### T05 — Reserva e ficha de hospedagem

- **Objetivo:** reunir acordo comercial e permanência.
- **Obrigatórios:** pagador/contato, datas, acomodações, ocupação e valor acordado.
- **Na entrada:** identificar titular e acompanhantes conforme política; mostrar valor calculado, adiantamento e saldo.
- **Ações:** confirmar, receber adiantamento, entrar, trocar quarto, lançar bebida, consultar restaurante vinculado, receber saldo, sair, cancelar e acompanhar cobrança empresarial depois da saída.
- **Detalhes:** histórico, cobranças e pagamentos acessíveis na mesma ficha; preço por noite consultável.
- **Efeitos:** cada ação executa apenas suas consequências; confirmar reserva não equivale a receber dinheiro. Saída empresarial não quita dívida; consumo do restaurante conserva sua origem.
- **Aceitação:** um hóspede por duas noites a R$ 180/pessoa/noite e bebidas de R$ 24 geram conta de R$ 384; adiantamento de R$ 100 deixa R$ 284, sem duplicar receita. Empresa a prazo pode manter esse saldo após check-out.

### T06 — Atendimento do restaurante

- **Objetivo:** montar pedido de mesa, balcão, buffet ou marmita com poucos passos.
- **Obrigatórios:** canal e itens; cliente obrigatório somente para prazo/empresa/entrega que exija contato.
- **Exibir:** preço, quantidade/unidade, total, preparo e situação financeira.
- **Marmita:** tamanho/variante, observação, horário e retirada/entrega quando usada.
- **Buffet livre:** preço padrão por pessoa/refeição e quantidade; não exige pesagem.
- **Buffet por quilo:** preço padrão/kg, peso líquido e tara quando aplicável, com cálculo visível.
- **Complementos:** mostrar se bebidas e extras estão incluídos ou cobrados à parte; não presumir inclusão no buffet livre.
- **Ações:** adicionar, enviar/preparar, entregar, receber diretamente, lançar na hospedagem ativa, cobrar na empresa ou cancelar conforme estado.
- **Aceitação:** pedido de balcão é válido sem mesa; kg e unidades coexistem sem arredondar peso para inteiro.

### T07 — Preparo, retirada e entrega

- **Objetivo:** cozinha e atendimento enxergarem o que falta executar.
- **Exibir:** sequência, previsão, itens, observações e quantidade preparada/entregue.
- **Estados:** aguardando, em preparo, pronto, entregue/parcial, cancelado.
- **Ações:** atualizar preparo e confirmar entrega; registrar falta, troca ou perda com responsável.
- **Regra:** entrega confirma consumo físico; pagamento pode ocorrer antes ou depois conforme condição.
- **Aceitação:** cliente pagar antecipadamente não marca marmitas como entregues.

### T08 — Contrato de empresa

- **Objetivo:** tornar explícito o combinado com o cliente.
- **Obrigatórios:** empresa, vigência, X refeições, Y funcionários, base de X (total do grupo ou por funcionário), dias/tipos de refeição, preços, política de cobrança, fechamento e vencimento.
- **Complementares:** local de entrega, contato, beneficiários e limite individual quando necessários.
- **Exibir:** vigente/suspenso/encerrado, compromisso diário, fornecido, diferença/excedente, ainda não cobrado e dívida.
- **Ações:** ativar, suspender, renovar e ajustar quantidade, grupo ou tabela futura; alteração relevante preserva versão anterior.
- **Aceitação:** reajuste passa a valer na data definida; refeições anteriores mantêm preço contratado anterior.

### T09 — Registro e fechamento de fornecimentos

- **Objetivo:** comprovar o realizado e cobrar uma vez.
- **Obrigatórios do registro:** contrato, data, tipo e quantidade efetiva; mostrar quantidade diária contratada e Y funcionários para conferência.
- **Origem:** pedido entregue ou registro diário; beneficiário/referência de entrega conforme acordo.
- **Fechamento:** prévia detalhada, período, ajustes, vencimento e total; confirmação gera cobrança.
- **Ações posteriores:** consultar demonstrativo, alocar recebimento e corrigir por ajuste.
- **Regra:** previsto e fornecido são distintos; falta/excedente aparece na conferência. Período sem consumo não gera cobrança por realizado; cobrança de reservado/fixo depende de política explicitamente confirmada.
- **Aceitação:** 30 refeições a R$ 20 geram R$ 600; repetir confirmação retorna o mesmo fechamento.

### T10 — Receber compra

- **Objetivo:** registrar recebimento real e obrigação com fornecedor sem redigitação.
- **Obrigatórios:** fornecedor, unidade/destino, data, itens, quantidade aceita, conversão, custo e condição de pagamento.
- **Para perecíveis:** lote e validade; lote interno permitido quando código não estiver disponível.
- **Complementares:** referência de documento, frete, desconto, encomenda prévia e observações.
- **Prévia:** total, quantidades-base que entrarão, lotes/local e parcelas previstas.
- **Efeitos:** confirmação consistente de recebimento, estoque e obrigação; opção “pagar agora” usa operação financeira vinculada.
- **Aceitação:** 2 caixas de 12 bebidas geram 24 unidades no estoque selecionado e uma obrigação, não duas.

### T11 — Estoque, validade, perdas e inventário

- **Objetivo:** saber o saldo utilizável e corrigir divergência física com história.
- **Exibir:** unidade/local, item, saldo total/utilizável, lote, validade e mínimo.
- **Ações:** perder/descartar, contar, aprovar ajuste, transferir quando permitido e consultar origem.
- **Campos de ajuste:** quantidade contada, corte, diferença, motivo e responsável.
- **Regra:** informação de vencimento não comprova descarte; item vencido é bloqueado até destinação.
- **Aceitação:** lote vencido continua rastreável mas não disponível para venda; queda de saldo posterior à contagem não é apagada.

### T12 — Fichas, produção e fechamento da cozinha

- **Objetivo:** acompanhar ingrediente consumido, rendimento, saída pronta e desperdício.
- **Obrigatórios:** preparação/ficha, versão, quantidade produzida e consumo real ou sugerido confirmado.
- **Complementares:** hora, validade informada, lote de saída, observação e sobra/perda.
- **Exibir:** custo estimado e real registrado, rendimento e diferenças.
- **Regra:** modo em lote baixa ingredientes na produção e produto preparado na entrega; modo sob demanda não recebe lote produzido por fora.
- **Aceitação:** ingrediente consumido para 50 marmitas não é consumido outra vez na venda das mesmas 50 unidades.

### T13 — Caixa e recebimentos

- **Objetivo:** liquidar cobrança e controlar dinheiro físico.
- **Obrigatórios:** saldo a quitar, valores/meios, caixa/conta conforme meio e responsável.
- **Exibir:** saldo, troco, pagamentos anteriores e destino de cada valor.
- **Ações:** abrir turno, receber, suprir/sangrar, estornar e fechar.
- **Regra:** troca de turno não desloca lançamentos históricos; transferência entre negócios não é venda.
- **Aceitação:** receber R$ 40 em PIX e R$ 70 em dinheiro para conta de R$ 100 gera troco de R$ 10 e quitação de R$ 100.

### T14 — Contas, bancos e fluxo de caixa

- **Objetivo:** decidir o que pagar/receber e conferir saldo.
- **Exibir:** unidade, pessoa, origem, emissão, vencimento, saldo, liquidações e atraso.
- **Ações:** pagar/receber parcialmente, alocar adiantamento, conferir extrato, registrar repasse e gerar previsão recorrente.
- **Regra:** cartão previsto não integra saldo bancário disponível; título pago não é editável como se nunca tivesse sido liquidado.
- **Aceitação:** repasse líquido considera taxa e baixa recebível sem registrar outra venda.

### T15 — Gestão, notificações e administração

- **Objetivo:** conferir resultados e manter o sistema recuperável.
- **Exibir:** unidade/período, conceito de cada indicador, detalhamento e pendências relevantes.
- **Ações:** consultar/exportar, resolver aviso, configurar políticas e acessos, acompanhar backup.
- **Regra:** importação/restauração exige permissão específica, ambiente identificado e procedimento de manutenção.
- **Aceitação:** relatório de empresa é demonstrativo gerencial; backup completo é identificado como diferente de exportação CSV/JSON.

## 10. Fluxos de ponta a ponta

### F01 — Bebida da pousada

Compra de bebida → recebimento no local da pousada → lote e saldo → consumo na hospedagem → baixa física → cobrança da hospedagem → recebimento → caixa/conta. O próximo hóspede não herda consumos. Requisitos: ORG-02, HOS-05/06, EST-01/04, FIN-01/02.

### F02 — Hospedagem

Selecionar pagador/período → escolher acomodações/quantidade de hóspedes → sugerir tarifa por pessoa conforme quarto/ocupação → confirmar acordo → registrar adiantamento se houver → check-in → diárias/bebidas e restaurante vinculado → quitação ou cobrança empresarial a prazo → check-out → limpeza → liberação. Na saída a prazo, acompanhamento da dívida continua; disponibilidade e dinheiro permanecem estados distintos. Requisitos: HOS-01 a HOS-13.

### F03 — Marmita avulsa

Pedido no balcão/retirada → produto/tamanho → preparo ou alocação de produção pronta → entrega → cobrança → pagamento. Pagamento antecipado muda apenas situação financeira. Ingredientes ou produto pronto são baixados conforme estratégia definida, uma única vez. Requisitos: VEN-01/02/03, COZ-02/03/04, FIN-02.

### F04 — Buffet

Produção de cozinha → exposição/consumo → selecionar buffet livre (quantidade de pessoas/refeições × preço fixo) ou buffet por quilo (peso líquido × preço/kg) → adicionar bebidas/extras conforme oferta → fechamento do atendimento → registro de sobras e perdas → conferência de estoque. O valor comercial do prato não é uma receita técnica de ingredientes. Requisitos: VEN-04/05/06/15/16, COZ-05, REL-05.

### F05 — Fornecimento empresarial

Contrato vigente com X refeições, Y funcionários e base diária definida → agenda nos dias/tipos atendidos → preparo/pedido quando usado → quantidade efetivamente fornecida → conferir falta/excedente contra compromisso diário → registro confirmado → fechamento conforme política comercial → demonstrativo e título → recebimento → saldo quitado. Previsão, contrato e fechamento não geram baixas físicas adicionais. Requisitos: EMP-01 a EMP-09 e EMP-12 a EMP-16.

### F06 — Compra

Escolher fornecedor/unidade → itens e custo → conferir mercadoria → aceitar/recusar → lotes e destino → confirmar recebimento/obrigação → pagar conforme prazo. Pedido prévio é opcional; serviço sem estoque é despesa. Requisitos: COM-01 a COM-09.

### F07 — Transferência física

Escolher item/lote, origem e destino → conferir autorização e saldo → confirmar saída e entrada vinculadas → consultar histórico. Não há transferência implícita para suprir falta de estoque. Habilitação depende da estrutura operacional/jurídica confirmada. Requisitos: EST-08, ORG-02.

### F08 — Inventário

Definir corte/local → registrar contagens → mostrar diferenças → supervisor confere → gerar ajustes → conciliar saldo com movimentos posteriores. Inventário não é edição direta do total. Requisitos: EST-06/07.

### F09 — Cancelamento/devolução

Identificar fato original → informar motivo → decidir efeito comercial, físico e financeiro separadamente → obter aprovação quando necessária → confirmar compensações vinculadas. Alimento já consumido não retorna ao estoque por estorno de dinheiro. Requisitos: VEN-10, COM-07, FIN-13.

### F10 — Fechamento diário

Concluir/prestar contas de pedidos → registrar consumo de cozinha/sobras → conferir fornecimentos das empresas → contar caixa → fechar turno → verificar pagamentos, vencimentos e validade → consultar pendências de backup. Não exige recontar manualmente todas as vendas em outra tela.

### F11 — Cartão

Venda/obrigação → recebimento por cartão → recebível previsto → repasse real com taxa → movimento bancário → conferência de extrato. Uma venda, um recebível e um repasse não são três receitas. Requisitos: FIN-05/09, REL-01.

### F12 — Despesa comum

Registrar documento único → classificar Pousada/Restaurante ou ratear explicitamente → obrigação única → pagamento único → resultado por unidade. Somar percentuais/valores até total do documento; não inventar uma segunda saída bancária. Requisito condicional: FIN-14.

## 11. Estados e regras de transição

Estados são dimensões do negócio. Um pedido pode estar entregue e não pago; um contrato pode estar encerrado com saldo a receber.

| Documento/dimensão | Estados propostos | Regra de transição |
| --- | --- | --- |
| Reserva | Rascunho, confirmada, entrada realizada, concluída, cancelada, no-show. | Confirmar bloqueia período; cancelamento/no-show liberam segundo política, preservando efeitos financeiros. Rascunho não bloqueia indefinidamente. |
| Hospedagem | Em andamento, encerrada. | Encerramento exige quitação ou condição empresarial a prazo identificada/autorizada; situação da dívida é independente da saída. |
| Quarto físico | Pronto, ocupado, limpeza, bloqueado. | Manutenção/bloqueio e disponibilidade futura não são o mesmo atributo. |
| Pedido operacional | Aberto, confirmado, em preparo, pronto, parcialmente entregue, entregue, cancelado. | Cancelar parte executada exige ajuste do item/entrega e destinação física, não simples exclusão. |
| Pedido financeiro | Sem cobrança, cobrado, parcialmente liquidado, liquidado, estornado parcial/total. | Derivado das obrigações/liquidações; não determinado pela cozinha. |
| Contrato | Rascunho, ativo, suspenso, encerrado. | Vigência e situação são verificadas na data do fornecimento; encerrar não apaga cobrança pendente. |
| Fornecimento | Previsto, confirmado, ajustado/cancelado por compensação. | Previsto não é cobrável; confirmado identifica realizado. |
| Fechamento empresarial | Prévia, confirmado, substituído por ajuste autorizado. | Confirmação conserva seleção única e preço histórico; ajustes não apagam demonstrativo anterior. |
| Compra | Rascunho, confirmada, parcial/totalmente recebida, encerrada/cancelada. | Estado de recebimento não significa pagamento. |
| Parcela | Aberta, parcial, quitada, cancelada/ajustada. | Derivada das alocações; “vencida” é condição de data sobre saldo aberto. |
| Lote | Utilizável, bloqueado, vencido, esgotado. | Vencimento não remove quantidade; desbloqueio administrativo não torna alimento vencido utilizável. |
| Inventário | Em contagem, em revisão, aprovado, cancelado antes de ajuste. | Após aprovação, correção por novo ajuste relacionado. |
| Turno de caixa | Aberto, em conferência, fechado. | Um aberto por caixa físico; fechamento preserva contagem, movimentos e divergência. |

Prazo de rascunho de reserva, tolerâncias de peso e regras de exceção serão definidos na validação; não há bloqueios eternos ou tolerâncias escondidas por padrão.

## 12. Relatórios, conceitos e cálculos

### 12.1 Conceitos que a interface deve distinguir

- **Vendido/prestado:** operação realizada segundo data do serviço/entrega, descontados ajustes comerciais.
- **Cobrado:** obrigação formalizada, incluindo fechamento da empresa.
- **Recebido:** valor liquidado; mostrar meio e se já disponível no banco.
- **Saldo bancário disponível:** inicial conciliado + entradas efetivas − saídas efetivas.
- **Previsto:** títulos, repasses e estimativas claramente identificados.
- **Custo consumido:** valor dos itens retirados/consumidos, não simplesmente compras pagas.
- **Margem estimada:** receita menos custo conhecido da ficha/produção; indicar cobertura incompleta.
- **Resultado gerencial:** apuração operacional com critérios explícitos; não apresentar como contabilidade oficial.

### 12.2 Conjunto mínimo

| Relatório | Conteúdo e regra |
| --- | --- |
| Pousada do dia | Chegadas, saídas, ocupação, limpeza, bloqueios e saldos pendentes. |
| Ocupação por período | Diárias ocupadas / diárias disponíveis; mostrar bloqueios excluídos e critério de disponibilidade. |
| Diária média | Receita de diárias prestadas / diárias ocupadas; excluir bebidas e não usar adiantamentos como receita prestada. |
| Restaurante | Quantidade/valor por canal, item, horário, ajuste e situação; kg e refeições/unidades em colunas próprias. |
| Empresas | X refeições, Y funcionários, base e compromisso diário; contratado/previsto, fornecido, diferença/excedente, não cobrado, cobrado, recebido e saldo por contrato/período, sem duplicação. |
| Estoque/validade | Saldo utilizável por local/lote, próximos vencimentos, mínimo e perda por motivo. |
| Compras | Fornecedor, item, quantidade, conversão, custo e variação do preço de compra. |
| Cozinha | Produzido, consumido, rendimento, perdas e custo registrado. |
| Caixa/contas | Movimentos efetivos, turnos, contagem, divergência, transferências e itens não conciliados. |
| Contas e projeção | Vencimentos, atrasos, parcelas, saldo projetado e recebíveis de cartão separados. |
| Resultado por unidade | Receitas operacionais, custos consumidos, perdas e despesas; critérios e dados faltantes visíveis. |

### 12.3 Cálculos e prevenção de duplicidade

1. Preço de linha = quantidade na unidade de cobrança × preço acordado, com arredondamento monetário definido.
2. Peso líquido = bruto − tara quando ambos forem informados. Não descontar tara de leitura já líquida.
3. Total comercial = soma das linhas − descontos + acréscimos autorizados.
4. Saldo de parcela = valor ajustado − alocações válidas; estorno de alocação restaura saldo.
5. Fechamento variável empresarial = soma dos fornecimentos elegíveis e ajustes; não somar novamente os pedidos de origem.
6. Custo médio por item/local é mantido por movimentos de entrada valorizados; transferências conservam valor.
7. FEFO escolhe vencimento físico; método de custo gerencial e ordem de retirada são conceitos diferentes.
8. CMV por inventário = estoque inicial + entradas valorizadas − estoque final, ajustado por transferências/produção e destinação. Perdas e benefícios são classificados dentro dessa variação, não somados novamente como se fossem consumos adicionais.
9. Receita da pousada usa diárias prestadas e cobranças de suas bebidas; reserva futura e adiantamento ficam em visões próprias. Consumo do restaurante apresentado na hospedagem permanece receita do restaurante.
10. Consolidado elimina transferências internas e evita somar venda + título + recebimento como receitas independentes.

Apuração detalhada por competência depende de datas de serviço, estoque e classificação suficientes. Na ausência desses dados, o relatório deve assumir e exibir seu caráter de caixa/estimativa.

## 13. Requisitos de qualidade e operação

| ID | Requisito | Forma de verificação futura |
| --- | --- | --- |
| QUA-01 | Integridade: confirmar documento e efeitos relacionados integralmente, ou não aplicar nenhum efeito. | Falha simulada em compra, entrega e liquidação não deixa saldo/título parcial. |
| QUA-02 | Reenvio seguro: repetição da mesma confirmação não cria efeitos duplicados. | Repetir pedido após resposta perdida retorna o mesmo resultado. |
| QUA-03 | Concorrência: versão em cadastros e confirmação contra estado vigente; estoque, crédito e disponibilidade protegidos. | Dois usuários concorrentes recebem resultado coerente e explicação de conflito. |
| QUA-04 | Autorização por ação/unidade no servidor, inclusive consultas, exportações e anexos. | Chamada direta a documento de outra unidade é recusada. |
| QUA-05 | Auditoria de ajustes, cancelamentos, preços, contratos, acessos e liquidações sem registrar segredos. | Origem, motivo, executor e aprovador identificáveis. |
| QUA-06 | Datas de negócio em calendário; eventos com instante e fuso operacional explícito. | Virada de dia/mês não desloca fornecimento, limite ou relatório. |
| QUA-07 | Operação local continua sem internet se servidor e rede local estiverem disponíveis. | Cadastro/venda funcionam; busca de CNPJ falha com alternativa manual. |
| QUA-08 | Sem servidor/rede, sinalizar indisponibilidade e não afirmar que salvou. | Formulário preservado quando possível; retomada exige confirmação segura. |
| QUA-09 | Sincronizar atualizações sem sobrescrever formulário em edição. | Segundo usuário vê novo estado; edição antiga recebe comparação. |
| QUA-10 | Interface consistente, português simples, unidade/ambiente visíveis, estados e consequências claros. | Funcionário executa cenários sem interpretar siglas técnicas. |
| QUA-11 | Desktop por teclado; mobile com campos adequados, foco, ações de toque e sem rolagem horizontal essencial. | Cenários T05/T06/T10 em celular e computador. |
| QUA-12 | Alvos frequentes de toque de 44 px como objetivo de desenho; não depender apenas de cor. | Inspeção de dimensões, contraste, rótulos e foco. |
| QUA-13 | Meta inicial: cinco usuários simultâneos e confirmação usual em até 2 s na máquina final, com volume representativo. | Medir percentil 95; investigar operações lentas. Meta depende de dimensionamento, não promessa de desempenho atual. |
| QUA-14 | Backup completo, segunda pasta opcional, retenção e restauração verificável. | Recuperar usuários, documentos, saldos e auditoria em ambiente isolado. |
| QUA-15 | Frequência de backup e tempo de recuperação devem ser acordados; proposta inicial RPO 24 h e RTO 4 h. | Proprietário confirma tolerância; exercício real mede tempo. Sincronizar pasta não prova existência de cópia externa. |
| QUA-16 | Demonstração isolada de dados, credenciais, volumes, notificações e destinos de backup operacionais. | Alterar/resetar demo não altera produção. |
| QUA-17 | Dados pessoais mínimos por rotina, acesso restrito e histórico sem senhas/dados de cartão completos. | Revisar campos, logs e exportações. Prazos de retenção serão acordados. |
| QUA-18 | Consulta de CNPJ com prazo, controle de chamadas/cache e preenchimento manual; nenhuma varredura em massa. | Falha externa não impede operação; dados não são atualizados silenciosamente. |
| QUA-19 | Importação inicial com prévia, validação, relatório de rejeições e ausência de duplicação. | Carregar exemplo duas vezes não cria clientes ou saldos repetidos. |
| QUA-20 | Instalação e atualização previsíveis, sem arquitetura distribuída desnecessária. | Responsável consegue iniciar, diagnosticar, fazer backup e restaurar com guia. |

**QUA-08 não significa que falha de resposta comprova falha de gravação.** Se a confirmação foi enviada e a resposta se perdeu, a tela informa “resultado ainda não confirmado” e consulta/reenvia a mesma operação com proteção contra duplicação. “Não salvo” só é mostrado quando houver evidência de recusa; nunca se cria uma operação nova para adivinhar o resultado.

Não é necessário escolher novos serviços ou infraestrutura para aprovar esses requisitos. O servidor atual pode continuar como ponto de partida; sua capacidade real será medida na homologação.

## 14. Cenários de aceitação

São exemplos para revisar a modelagem com o cliente. Valores são ilustrativos; não são tabela comercial aprovada.

| Cenário | Resultado esperado | Referência |
| --- | --- | --- |
| A01 — Mesmo refrigerante nas duas unidades | Venda de 2 unidades na pousada reduz apenas seu saldo; restaurante fica intacto. | ORG-02, EST-01/05 |
| A02 — Pousada sem saldo e restaurante com saldo | Venda da pousada é recusada; não transfere produto automaticamente. | EST-08/10 |
| A03 — Recebimento convertido | 2 caixas de 12 entram como 24 unidades; custo total R$ 120 resulta em custo-base R$ 5, antes de frete/ajustes. | COM-01/03 |
| A04 — Lotes com validades diferentes | A saída utiliza primeiro o lote válido que vence antes; saldo vencido não supre falta. | EST-02/03 |
| A05 — Pessoa repetida | Mesmo documento normalizado não cria segundo cadastro; alteração do documento conserva ID e histórico. | CAD-02/06 |
| A06 — CNPJ alfanumérico | Letras são preservadas; máscara e validação não removem caracteres válidos. | CAD-05 |
| A07 — Consulta indisponível | Funcionário cadastra empresa manualmente e continua operação. | CAD-04, QUA-18 |
| A08 — Tarifa e adiantamento | 2 × R$ 180 + R$ 24 em bebidas − R$ 100 adiantados = R$ 284 em aberto. | PRE-01, HOS-06 |
| A09 — Troca de quarto | Mesma hospedagem conserva bebidas e pagamentos; quarto anterior segue para limpeza. | HOS-07 |
| A10 — Grupo concorrente | Conflito em um quarto impede confirmação parcial silenciosa do grupo. | HOS-03, QUA-03 |
| A11 — Buffet por quilo | Bruto 0,700 kg − tara 0,200 kg = 0,500 kg; a R$ 50/kg, cobrar R$ 25. | VEN-04/05 |
| A12 — Marmita sem mesa | Pedido é válido, pode estar pago e ainda em preparo; entrega registra execução. | VEN-01/02/03 |
| A13 — Produção e venda | Produzir 50 marmitas baixa ingredientes; entregar 20 baixa 20 preparadas, sem nova baixa dos ingredientes. | COZ-02/03 |
| A14 — Alimento consumido estornado | Reembolso não cria alimento disponível; perda/consumo permanece rastreável. | VEN-10, FIN-13 |
| A15 — Fornecimento empresarial | 30 refeições a R$ 20 geram R$ 600 de fornecimento e uma cobrança no fechamento; saldo permanece até pagamento. | EMP-02/05 |
| A16 — Reajuste contratual | Refeição de antes do início do reajuste conserva preço anterior; a seguinte usa preço novo. | PRE-03, EMP-03 |
| A17 — Duplo fechamento | Duas confirmações simultâneas não cobram as mesmas refeições duas vezes. | EMP-06, QUA-02/03 |
| A18 — Pagamento parcial | Cobrança R$ 600, recebimento R$ 250: saldo R$ 350; não registrar nova venda de R$ 250. | EMP-08, FIN-02 |
| A19 — Meio misto e troco | Conta R$ 100; PIX R$ 40 e dinheiro R$ 70: troco R$ 10; caixa recebe líquido R$ 60. | VEN-08, FIN-04 |
| A20 — Cartão | Venda R$ 100, taxa R$ 3: banco não cresce na venda; repasse de R$ 97 liquida recebível e registra taxa. | FIN-05 |
| A21 — Inventário com movimento posterior | Saldo no corte 20, contagem 18, saída posterior 3: ajuste −2 conserva saldo final 15. | EST-07 |
| A22 — Despesa comum, se usada | Gasto R$ 200, rateio 60/40: resultados recebem R$ 120/R$ 80; banco sai apenas R$ 200. | FIN-14 |
| A23 — Recorrência | Executar gerador duas vezes cria uma obrigação do período, sem marcar pagamento. | FIN-11 |
| A24 — Permissão por unidade | Operador do restaurante não acessa hospedagem por adivinhar seu ID. | QUA-04 |
| A25 — Resposta perdida | Reenviar confirmação de compra retorna documento existente sem nova entrada ou dívida. | QUA-01/02 |
| A26 — Contrato suspenso | Novo consumo contratual é bloqueado; cobrança e recebimento anteriores continuam acessíveis. | EMP-09 |
| A27 — Benefício de funcionário | Consumo gratuito baixa estoque e registra custo/benefício; não aumenta vendas recebidas. | COZ-07 |
| A28 — Cancelamento de reserva paga | Multa e destinação do saldo são aprovadas; crédito não gera entrada de dinheiro. | HOS-09/10, FIN-03 |
| A29 — Rede interrompida | Tela informa que o resultado ainda não foi confirmado; consulta/reenvio com a mesma identidade resolve sem duplicar documento. | QUA-02/08 |
| A30 — Recuperação | Restaurar cópia em ambiente isolado recupera documentos, usuários, permissões e saldos reconciliáveis. | QUA-14/15 |
| A31 — Buffet livre | 3 pessoas/refeições a R$ 30 geram R$ 90 sem pesar; bebida não incluída de R$ 8 acrescenta R$ 8. | VEN-04/15 |
| A32 — Modalidades e preços independentes | Alterar preço/kg não muda preço do livre nem vendas anteriores de qualquer modalidade. | PRE-01/03, VEN-16 |
| A33 — Contrato com X total do grupo | X = 40 refeições/dia, Y = 20 funcionários: compromisso diário é 40, não 800; fornecido 35 gera diferença de 5. | EMP-13/14 |
| A34 — Contrato com X por funcionário | X = 2 refeições/funcionário/dia, Y = 20: compromisso diário é 40; o modo e os tipos de refeição ficam explícitos. | EMP-13 |
| A35 — Faltas e excedentes | Contratado 40, fornecido 35: não inventar 5 entregas; fornecido acima de 40 exige regra autorizada. Valor cobrável segue política definida, não inferência. | EMP-10/14/16 |
| A36 — Mudança do grupo | Y passa de 20 para 25 a partir da data acordada; previsão futura muda conforme base de X, sem alterar fornecimentos/fechamentos passados. | EMP-15 |
| A37 — Tarifa por pessoa e ocupação | Quarto A cobra R$ 120/pessoa para ocupação de 1 e R$ 100/pessoa para ocupação de 2: uma noite com dois hóspedes soma R$ 200; não R$ 120 nem R$ 100. | PRE-05 |
| A38 — Saída empresarial em aberto | Empresa com saldo R$ 284: check-out encerra hospedagem e manda quarto para limpeza, conservando dívida R$ 284, pagador e vencimento. Recebimento posterior quita sem nova venda. | HOS-08/11 |
| A39 — Restaurante direto ou na hospedagem | Pedido de R$ 60 pode ser pago no restaurante ou vinculado à hospedagem; não pode ser cobrado/pago nas duas rotas. Estoque e receita permanecem no restaurante. | HOS-12/13 |

## 15. Decisões pendentes

As propostas desta tabela não equivalem a autorização nem à descrição do que já ocorre. As linhas marcadas como respondidas registram confirmações do responsável. Esta tabela é um registro interno de decisões, não um questionário de dezoito perguntas ao cliente. A seção 15.2 define a rodada mínima antes do protótipo.

| ID | Pergunta | Proposta para manter simples | Impacto da resposta |
| --- | --- | --- | --- |
| P01 | Há um ou dois CNPJs/titulares jurídicos? | Duas unidades operacionais sempre; titularidade cadastral separada quando necessária. | Contas compartilhadas, transferências e consolidação. |
| P02 | Existem um ou dois caixas físicos e contas bancárias próprias? | Um turno por caixa físico real; movimentos sempre com unidade. | Número de caixas, responsáveis e saldos. |
| P03 | Livre e por quilo estão confirmados. Quais preços, tara e inclusões/extras valem em cada modalidade? | Duas ofertas explícitas; livre por pessoa/refeição, por quilo por peso líquido; peso digitado inicialmente. | Quantidades, PDV e preço padrão. |
| P04 | X refeições é o total do grupo ou por funcionário? Em quais dias/tipos? Falta de consumo é cobrada? Como autorizar/cobrar excedente? | Registrar X, Y e base diária explicitamente; contratado, fornecido e cobrável separados. | Cota diária, contrato, demonstrativo e cobrança. |
| P05 | Como comprovar fornecimento: total diário, pedido entregue, matrícula ou assinatura? | Total diário por empresa/tipo, com origem e responsável; identificação individual apenas quando exigida. | Campos, privacidade e velocidade de atendimento. |
| P06 | Quando fecha e vence a cobrança de cada empresa? Há atraso ou limite? | Configuração por contrato, saldo e alerta; bloqueio/exceção acordados. | Crédito e contas a receber. |
| P07 | Marmitas são produzidas em lote ou montadas sob demanda? Têm tamanhos/proteínas com preços próprios? | Variantes explícitas para preço; uma estratégia de baixa por preparação. | Receita, produção e produto preparado. |
| P08 | Há entrega de marmitas e contratos? Qual controle mínimo de endereço/taxa/retirada? | Lista simples de pedidos/entregas, sem roteirização. | Campos e estados operacionais. |
| P09 — Respondida | Restaurante recebe diretamente ou lança na hospedagem: ambos. | Vínculo explícito e alocação do recebimento às origens, mantendo unidades separadas. | Cobrança entre unidades e liquidação. |
| P10 — Respondida | Empresas pagam depois da saída e a conta fica aberta. | Separar encerramento da hospedagem de quitação, com cobrança empresarial vinculada. | Política de saída, pagador e crédito. |
| P11 — Respondida | Tarifa por pessoa, variável conforme quarto e quantidade de hóspedes. | Tabela por quarto/categoria e ocupação, com preço por pessoa preservado por noite. Detalhes complementares no protótipo. | Cálculo por noite e dados de ocupação. |
| P12 | Como registrar consumo e sobra do buffet sem sobrecarregar cozinha? | Produção do dia e fechamento simples de sobras/perdas; inventário periódico. | Precisão de custo, esforço diário e indicador exibido. |
| P13 | Quem recebe mercadoria e quem pode ajustar perda/inventário? | Recebedor registra; gestor aprova divergência relevante. Evitar aprovação para toda rotina comum. | Perfis e exceções. |
| P14 | Pode transferir bebidas entre negócios? Há despesas comuns? | Operação explícita, nunca automática; rateio só se usado. | Documentos e resultado consolidado. |
| P15 | Há recebimento de cartão, prazos e taxas conhecidos? | Agenda e repasse manual com taxa configurável; sem integração de adquirente. | Saldo previsto e conciliação. |
| P16 | Quais dados pessoais/documentos são exigidos na hospedagem? | Coletar mínimo definido pela rotina e requisitos aplicáveis; política de retenção própria. | Cadastro, acompanhantes e exposição de informações. |
| P17 | Que perda de dados e tempo parado são toleráveis? | Proposta inicial: até 24 h de dados e recuperação em até 4 h, a validar. | Frequência de backup, cópia externa e plano de contingência. |
| P18 | Quais dados históricos reais precisam ser migrados? | Não inferir estoque por unidade ou pagamento apenas de textos; conciliar saldos de abertura. | Migração futura e validação. |

### 15.1 Decisões já encerradas e detalhes adiados

- Tarifa por pessoa, por quarto e por quantidade de hóspedes: confirmada; valores reais, faixas e casos especiais são configuráveis.
- Empresa paga hospedagem depois da saída: confirmado; vencimento e rotina de cobrança são configuráveis.
- Restaurante recebe diretamente ou lança na hospedagem: ambos confirmados; agrupamento preserva origem e evita cobrança dupla.
- Buffet livre e por quilo: ambos confirmados; preço, tara, inclusões e extras são parâmetros de cadastro.
- Documento/CNPJ de cada negócio, despesas comuns, repasses e transferências: o modelo comporta identidade e unidade distintas; a configuração e o acerto serão mostrados no protótipo, sem pedir ao cliente decisões técnicas.
- Quantidades, preços, dias/horários de refeição, vencimento/fechamento, taxas e limites são configuração do negócio. Não precisam de valores definitivos para desenhar o protótipo.
- Retirada/entrega de marmitas pode ser uma opção do pedido já prevista no modelo. Não exige nova rodada de perguntas nem integração logística.
- Permissões, estoque mínimo, conversões e validade serão apresentados em exemplos configuráveis. Procedimento sanitário não é inventado pelo sistema.
- Backup, instalação, migração e homologação serão tratados com o responsável pela implantação, sem transformar o cliente em gerente de desenvolvimento. Isso não dispensa validá-los antes da operação real.

### 15.2 Rodada única e mínima de perguntas ao cliente

Objetivo: definir somente aspectos da rotina que mudam separação financeira, quantidade contratada, base da cobrança, identificação de consumo ou ponto de baixa física. Não perguntar novamente os itens já respondidos, nem pedir escolha de banco, tabelas, arquitetura ou infraestrutura.

1. **Dinheiro:** pousada e restaurante usam caixas e contas bancárias separados ou compartilham algum deles?
2. **Contrato:** combinam refeições por funcionário por dia ou um total diário para a empresa? Um exemplo de contrato é suficiente.
3. **Faltas:** se forem combinadas 20 refeições e somente 15 forem consumidas, cobram 20 ou 15?
4. **Identificação:** precisam saber qual funcionário comeu ou basta o total servido para cada empresa?
5. **Marmitas:** são preparadas antes em quantidade, montadas conforme os pedidos ou das duas formas?

As cinco perguntas correspondem aos itens ainda não respondidos do questionário anterior. Não foi identificado outro bloqueio necessário para construir o primeiro protótipo. A regra contratual pode variar entre empresas; quando houver essa variação, o cliente pode dizer “depende do contrato”, e a ficha permitirá configurá-la sem impor um padrão único.

### 15.3 Regras de trabalho até a apresentação do protótipo

- Receber as respostas da rodada acima e registrar o que for confirmado.
- Nos demais pontos, usar exemplos fictícios e opções configuráveis; identificar hipóteses sem apresentá-las como política já aprovada.
- Mostrar no protótipo os caminhos completos de venda, hospedagem a prazo, refeição empresarial, recebimento de compra e fechamento.
- Reunir ajustes de detalhes na apresentação do protótipo, evitando perguntas avulsas sobre cada campo.
- Se uma resposta revelar uma rotina nova que contradiga o modelo, registrar a divergência e sua proposta de tratamento para a apresentação. Não ocultar hipótese nem implementar regra financeira irreversível por inferência.

## 16. Processo de validação antes da implementação

### 16.1 Etapa A — Validar as rotinas reais

Com proprietário e funcionários, percorrer um dia de trabalho: entrada de compra, preparo, venda de buffet/marmita, consumo empresarial, recebimentos, hospedagem e fechamento. Usar exemplos reais de documentos com dados pessoais ocultados.

**Saída:** respostas às cinco perguntas da seção 15.2; lista de rotinas obrigatórias, condicionais e não utilizadas. Os demais pontos são apresentados como configuração/hipótese no protótipo. Não pedir ao usuário decidir detalhes técnicos do banco.

### 16.2 Etapa B — Revisar cada tela por tarefa

Para cada superfície da seção 4, revisar: quem usa, objetivo, entrada mínima, valor padrão, informação exibida, ação principal, efeito relacionado, correção e saída. Validar pelo menos as quinze fichas T01–T15 com sequências em papel ou protótipos sem efeito operacional.

**Saída:** inventário de telas aprovado e formulários com campos obrigatórios/opcionais definidos. Preservar estilo visual; não aprovar tela apenas por sua aparência.

### 16.3 Etapa C — Fechar o modelo lógico

Detalhar cardinalidades, chaves, vínculos de origem, regras de exclusividade, estados, valores derivados e retratos históricos. Verificar todos os cenários A01–A39 no papel.

**Saída:** mapa lógico consistente; cada valor tem fonte; cada alteração tem consequência definida. Ainda sem migrações.

### 16.4 Etapa D — Deliberar sobre prioridades

Concluir primeiro os ciclos que o negócio realmente usa. Recursos condicionais não podem entrar por conveniência técnica. A divisão futura em entregas deve respeitar dependências entre cadastro, preço, estoque, documento, cobrança e pagamento.

**Saída:** requisitos N confirmados, requisitos C habilitados ou adiados e critérios de aceitação aceitos.

### 16.5 Etapa E — Definir a transição

Somente depois da modelagem: avaliar reaproveitamento de telas/serviços, dados históricos, riscos, migração, reconciliação e homologação com usuários. Separar mudança de regra de mudança técnica.

**Saída:** plano de implementação futuro, com entrada/saída verificáveis. Não faz parte da execução desta solicitação.

### 16.6 Critério para considerar a modelagem pronta

- Operações separadas e regras de caixa/contas esclarecidas.
- Buffet, marmitas e contratos descritos com exemplos reais.
- Cliente, pagador, hóspede e beneficiário sem ambiguidade.
- Preço e custo com unidade, vigência e origem.
- Estoque por unidade/lote e ponto de baixa definidos.
- Compra/fornecimento/cobrança/pagamento ligados sem duplicação.
- Correções e cancelamentos com destino físico/financeiro definido.
- Cada requisito essencial ligado a tela, entidade e cenário.
- Perguntas estruturais resolvidas; demais pendências com responsável e efeito conhecido.
- Proprietário e pelo menos um operador de cada rotina conseguem explicar o fluxo proposto.

### 16.7 Matriz resumida de rastreabilidade

| Domínio | Telas | Entidades centrais | Requisitos | Cenários |
| --- | --- | --- | --- | --- |
| Organização/pessoas | T01/T02 | Unidade, Pessoa, Papel, Acesso | ORG/CAD, QUA-04 | A01/A05/A06/A07/A24 |
| Preço/catálogo | T03/T04 | Item, Oferta, Preço, Tarifa | PRE | A03/A08/A11/A16 |
| Hospedagem | T04/T05 | Reserva, Acomodação, Hospedagem, Tarifa por ocupação, Cobrança, Vínculo restaurante | HOS/PRE | A08/A09/A10/A28/A37/A38/A39 |
| Atendimento | T06/T07/T13 | Pedido, Item, Entrega | VEN | A11/A12/A14/A19/A31/A32 |
| Empresas | T08/T09/T14 | Contrato, Regra diária, Fornecimento, Fechamento | EMP | A15/A16/A17/A18/A26/A33/A34/A35/A36 |
| Compras | T10/T14 | Compra, Recebimento, Obrigação | COM | A03/A25 |
| Estoque/cozinha | T11/T12 | Local, Lote, Movimento, Produção | EST/COZ | A01/A02/A04/A13/A21/A27 |
| Financeiro/gestão | T13/T14/T15 | Parcela, Liquidação, Conta, Repasse | FIN/REL | A18/A19/A20/A22/A23 |
| Qualidade/operação | Todas; T15 | Auditoria, Acesso, referências de origem | QUA | A10/A17/A24/A25/A29/A30 |

## 17. Glossário e evidências locais

### 17.1 Glossário

| Termo | Significado neste documento |
| --- | --- |
| Unidade operacional | Atividade separada: pousada ou restaurante; não pressupõe um CNPJ próprio. |
| Pagador | Pessoa responsável pela obrigação financeira, que pode diferir de quem consome. |
| Beneficiário | Pessoa que recebe refeição ou hospedagem paga por outra pessoa/empresa. |
| Oferta | Forma de disponibilizar um item numa unidade, com preço e condições próprios. |
| Fornecimento | Quantidade efetivamente entregue/consumida por uma empresa contratante. |
| Fechamento empresarial | Consolidação gerencial de um período para formalizar cobrança; não é emissão fiscal. |
| Obrigação/título | Valor a pagar ou receber, com origem e vencimento. |
| Liquidação | Quitação parcial ou total mediante pagamento, recebimento ou crédito permitido. |
| Alocação | Parte de uma liquidação aplicada a uma parcela específica. |
| FEFO | Priorizar o lote válido com vencimento mais próximo na retirada. |
| CMV | Custo das mercadorias vendidas/consumidas, conforme método e classificação explicitados. |
| RPO/RTO | Perda máxima de dados tolerada / tempo pretendido para recuperar operação. |

### 17.2 Arquivos consultados e limites encontrados

| Evidência | O que fundamenta |
| --- | --- |
| [prisma/schema.prisma](../prisma/schema.prisma) | Entidades atuais; saldo único por produto; pedido com mesa obrigatória; consumo por quarto; cliente e hóspede separados; ausência de contrato/lote/local/compra integrada. |
| [components/dashboard-shell.tsx](../components/dashboard-shell.tsx) | Módulos realmente montados na navegação principal. |
| [components/financial-tab.tsx](../components/financial-tab.tsx) | Clientes, hóspedes e fornecedores dentro do Financeiro; pagamentos e turno. |
| [components/financial-cadastros-management.tsx](../components/financial-cadastros-management.tsx) | Contas, transferências, centros, orçamentos e recorrências. |
| [components/customers-management.tsx](../components/customers-management.tsx) | Cadastro atual e normalização numérica de CPF/CNPJ; sem consulta cadastral integrada identificada. |
| [components/consumption-sheet.tsx](../components/consumption-sheet.tsx) | Catálogo geral e lançamento de consumo associado ao quarto. |
| [components/manage-rooms-modal.tsx](../components/manage-rooms-modal.tsx), [checkin-modal.tsx](../components/checkin-modal.tsx), [reservations-tab.tsx](../components/reservations-tab.tsx) | Quarto, entrada e reserva sem tarifa padrão estruturada. |
| [components/restaurant/restaurant-tab.tsx](../components/restaurant/restaurant-tab.tsx), [order-sheet.tsx](../components/restaurant/order-sheet.tsx) | Atendimento centrado em mesa e cliente textual; cozinha e consumo de funcionário. |
| [components/stock/stock-tab.tsx](../components/stock/stock-tab.tsx), [stock-movement-modal.tsx](../components/stock/stock-movement-modal.tsx) | Catálogo/cardápio e movimentos manuais com custo/validade, sem saldo de lote. |
| [lib/hooks/useReports.ts](../lib/hooks/useReports.ts), [components/reports-tab.tsx](../components/reports-tab.tsx) | Indicadores de vendas centrados no POS; necessidade de redefinir cobertura/conceitos. |
| [docs/REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) | Quitação, cancelamento, crédito, preços, caixa, estoque e limites atuais. |
| [docs/PERMISSOES.md](PERMISSOES.md), [docs/CONCORRENCIA.md](CONCORRENCIA.md) | Controles existentes a preservar e ampliar ao novo domínio. |
| [docs/AVALIACAO_ERP_PEQUENA_EMPRESA.md](AVALIACAO_ERP_PEQUENA_EMPRESA.md) | Avaliação anterior de cobertura, com escopo anterior ao esclarecimento de separação operacional e exclusão fiscal. |

Componentes auxiliares ou históricos fora da navegação não foram classificados como telas disponíveis ao usuário. Existência de campo/tabela não foi tratada como evidência de um ciclo completo.

**Resultado desta etapa:** proposta documentada de requisitos, fluxos e modelo conceitual. Nenhuma mudança funcional, migração de banco ou alteração de interface é autorizada por este documento, isoladamente.

### 17.3 Histórico do documento

| Versão | Data | Alteração |
| --- | --- | --- |
| 0.1 | 08/10/2026 | Pesquisa, revisão funcional das telas e proposta inicial de requisitos/modelagem. |
| 0.2 | 09/10/2026 | Buffet livre e por quilo; contrato com X refeições para Y funcionários por dia; parâmetros diários, diferenças, vigência e cenários específicos. Cobrança de faltas/excedentes e base de X permanecem pendentes. |
| 0.3 | 09/10/2026 | Confirma tarifa por pessoa/quarto/ocupação, hospedagem empresarial com conta aberta após saída e restaurante direto ou na hospedagem. Consolida cinco perguntas restantes e adia detalhes configuráveis para o protótipo. |
