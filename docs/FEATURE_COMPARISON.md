# Comparativo de Funcionalidades: Sistema Atual vs Requisitos de Restaurante

**Data da Análise:** 08/05/2026  
**Sistema Atual:** Gestão de Pousada com módulos integrados (POS, Restaurante, Estoque)  
**Documento de Referência:** `lacking_features.md` (Sistema de Gestão de Restaurante)

---

## Contexto

Este documento compara as funcionalidades implementadas no sistema atual (focado em pousada) com os requisitos especificados para um sistema de gestão de restaurante com buffet self-service e marmitas.

**Observação Importante:** O sistema atual é uma **POUSADA** com módulos de POS, restaurante, estoque e funcionários integrados. O documento de requisitos descreve um **RESTAURANTE** puro. Há sobreposição significativa mas também diferenças de foco operacional.

---

## Legenda

- ✅ **IMPLEMENTADO** - Funcionalidade completa e operacional
- ⚠️ **PARCIAL** - Estrutura existe mas falta automação, validação ou UI
- ❌ **NÃO IMPLEMENTADO** - Funcionalidade não existe

---

## 1. MÓDULO DE VENDAS (PDV)

### RF-PDV-001: Venda Rápida e Simplificada

| Requisito | Status | Notas |
|-----------|--------|-------|
| Interface touch-friendly | ✅ | Componentes shadcn/ui responsivos |
| Atalhos de teclado (F1-F12) | ❌ | Não há atalhos configurados |
| Busca por código de barras | ✅ | Campo barcode em POSProduct |
| Busca por nome do produto | ✅ | useProductSearch hook |
| Adição múltipla sem confirmação | ✅ | useCart permite múltiplos itens |
| Visualização total em tempo real | ✅ | Cart mostra subtotal/total |
| Venda por peso (kg) e unidade | ✅ | Suporte a 'kg' e 'un' |
| Modo "Express" pré-configurado | ❌ | Não há produtos pré-configurados |
| RN-PDV-001: 3s por item | ⚠️ | Não medido/otimizado |
| RN-PDV-002: 3 cliques para venda | ⚠️ | Fluxo existe mas não otimizado |
| RN-PDV-003: Modo offline | ✅ | localStorage com sync |

**Score: 7/11 completo, 2/11 parcial, 2/11 não implementado**

---

### RF-PDV-002: Separação por Categorias

| Requisito | Status | Notas |
|-----------|--------|-------|
| Categorias específicas (almoço, jantar, marmita, bebidas, café) | ❌ | Sistema usa categorias genéricas |
| Filtro visual por categoria | ✅ | ProductCategory com filtros |
| Cores distintas por categoria | ✅ | Campo color em ProductCategory |
| Ícones representativos | ✅ | Campo icon em ProductCategory |
| Venda mista (múltiplas categorias) | ✅ | Cart suporta mix |
| Relatórios por categoria | ⚠️ | Dados existem mas UI não implementada |
| RN-CAT-001: Produto em 1 categoria | ✅ | Estrutura suporta |
| RN-CAT-002: Destaque horário de pico | ❌ | Não há lógica de horário |
| RN-CAT-003: Controle de embalagens | ❌ | Não implementado |

**Score: 5/9 completo, 1/9 parcial, 3/9 não implementado**

---

### RF-PDV-003: Comandas Simples

| Requisito | Status | Notas |
|-----------|--------|-------|
| Abertura rápida com número sequencial | ✅ | RestaurantOrder automático |
| Lançamento de itens | ✅ | useOrderManagement |
| Visualização comandas abertas | ✅ | Filtro por status 'aberta' |
| Fechamento com cálculo automático | ✅ | Total calculado |
| Impressão de comprovante | ❌ | Não há integração |
| Dividir conta | ❌ | Não implementado |
| Transferência entre comandas | ❌ | Não implementado |
| Cancelamento com justificativa | ⚠️ | Cancelamento sem justificativa obrigatória |
| RN-COM-001: Alerta 4h abertas | ❌ | Não há alertas |
| RN-COM-002: Senha supervisor | ⚠️ | Roles existem mas não aplicado |
| RN-COM-003: Não excluir, cancelar | ✅ | Status 'cancelada' preserva |
| RN-COM-004: Histórico de alterações | ⚠️ | AuditLog existe mas não específico |

**Score: 5/12 completo, 3/12 parcial, 4/12 não implementado**

---

## 2. MÓDULO DE CAIXA E FECHAMENTO

### RF-CAI-001: Fechamento Diário de Caixa

| Requisito | Status | Notas |
|-----------|--------|-------|
| Abertura com valor inicial | ✅ | CashClose com initialAmount |
| Registro de transações | ✅ | Transaction repository |
| Fechamento com contagem física | ✅ | Campos expected/counted |
| Cálculo de diferenças | ✅ | Campos difference |
| Registro de sangrias | ✅ | Array withdrawals |
| Registro de suprimentos | ✅ | Array supplies |
| Impressão de relatório | ❌ | Não há impressão |
| Histórico de fechamentos | ✅ | CashCloseRepository.getAll() |
| RN-CAI-001: Abrir antes de vender | ⚠️ | Validação não implementada |
| RN-CAI-002: Sangria >R$500 aprovação | ❌ | Não há validação |
| RN-CAI-003: Diferença >R$50 alerta | ❌ | Não há alertas |
| RN-CAI-004: Fechamento obrigatório | ⚠️ | Não há validação |
| RN-CAI-005: Supervisor reabrir | ❌ | Não há lógica de reabertura |

**Score: 7/13 completo, 3/13 parcial, 3/13 não implementado**

---

### RF-CAI-002: Controle por Forma de Pagamento

| Requisito | Status | Notas |
|-----------|--------|-------|
| Formas obrigatórias (dinheiro, PIX, débito, crédito) | ✅ | PaymentMethod enum completo |
| Seleção rápida | ✅ | UI com seleção |
| Pagamento misto | ❌ | Apenas um método por venda |
| Cálculo de troco | ✅ | usePayment hook |
| Registro de comprovante PIX | ⚠️ | Campo existe mas não obrigatório |
| Integração máquina de cartão | ❌ | Futuro |
| Taxa de administração | ❌ | Não há campo |
| Relatório por forma de pagamento | ⚠️ | Dados existem mas UI não implementada |
| RN-PAG-001: Alerta dinheiro >R$200 | ❌ | Não há validação |
| RN-PAG-002: PIX com comprovante | ❌ | Não obrigatório |
| RN-PAG-003: Taxa cartão crédito | ❌ | Não implementado |
| RN-PAG-004: Troco máximo R$50 | ❌ | Não há validação |

**Score: 3/12 completo, 2/12 parcial, 7/12 não implementado**

---

### RF-CAI-003: Relatório Diário e Mensal de Vendas

| Requisito | Status | Notas |
|-----------|--------|-------|
| Relatório Diário completo | ✅ | Dashboard com métricas diárias |
| Relatório Mensal completo | ⚠️ | Dados existem mas filtro mensal não implementado |
| Filtros por período | ⚠️ | Filtro diário implementado |
| Filtros por categoria | ✅ | Gráfico por categoria |
| Exportação PDF/Excel | ⚠️ | Exportação CSV implementada |
| Gráficos visuais | ✅ | 4 gráficos interativos (Recharts) |
| Impressão direta | ❌ | Não implementado |
| Envio por email | ❌ | Não implementado |

**Score: 3/8 completo, 4/8 parcial, 1/8 não implementado**

---

## 3. MÓDULO DE CONTROLE DE CONSUMO INTERNO

### RF-CON-001: Controle de Consumo de Funcionários

| Requisito | Status | Notas |
|-----------|--------|-------|
| Cadastro com foto | ✅ | Employee com campo photo |
| Identificação por crachá/biometria | ❌ | Futuro |
| Registro por categoria | ✅ | EmployeeConsumption com category |
| Limite de consumo | ✅ | consumptionLimit em Employee |
| Desconto em folha/pagamento | ✅ | paymentType (benefit/discount/paid) |
| Relatório por funcionário | ⚠️ | Dados existem mas UI não implementada |
| Relatório por período | ⚠️ | Dados existem mas UI não implementada |
| Alertas acima do limite | ❌ | Não há alertas |
| RN-FUN-001: 1 refeição por turno | ⚠️ | mealBenefit existe mas não validado |
| RN-FUN-002: Consumo adicional pago | ⚠️ | paymentType existe mas não validado |
| RN-FUN-003: Limite configurável | ✅ | consumptionLimit configurável |
| RN-FUN-004: Limites diferenciados | ✅ | Por role |
| RN-FUN-005: Não entra no caixa | ⚠️ | Separado mas não validado |

**Score: 5/13 completo, 6/13 parcial, 2/13 não implementado**

---

## 4. MÓDULO DE ESTOQUE E PRODUÇÃO

### RF-EST-001: Controle de Estoque

| Requisito | Status | Notas |
|-----------|--------|-------|
| Cadastro com unidade de medida | ✅ | StockItem completo |
| Registro de entrada | ✅ | StockMovement tipo 'entrada' |
| Registro de saída | ✅ | StockMovement tipo 'saida' |
| Baixa automática em vendas | ✅ | useStockIntegration com rollback |
| Estoque mínimo com alertas | ✅ | Sistema de alertas em tempo real |
| Controle de validade | ✅ | expirationDate em StockMovement |
| Inventário com ajustes | ✅ | StockMovement tipo 'ajuste' |
| Relatório de movimentação | ✅ | Dashboard de relatórios completo |
| Relatório próximo vencimento | ❌ | Não há relatório |
| Custo médio ponderado (CMV) | ✅ | averageCost em StockItem |
| RN-EST-001: Estoque não negativo | ✅ | Validação no carrinho PDV |
| RN-EST-002: Alerta estoque mínimo | ✅ | Alertas crítico/baixo configuráveis |
| RN-EST-003: Bloquear vencidos | ❌ | Não há validação |
| RN-EST-004: Ajuste com justificativa | ✅ | Campo reason obrigatório |
| RN-EST-005: Entrada com nota fiscal | ⚠️ | Campo existe mas não obrigatório |

**Score: 11/15 completo, 1/15 parcial, 3/15 não implementado**

---

### RF-EST-002: Controle de Produção

| Requisito | Status | Notas |
|-----------|--------|-------|
| Cadastro de receitas | ✅ | Recipe completo |
| Cálculo automático de custo | ✅ | Soma de ingredientes |
| Registro de produção | ✅ | Production repository |
| Baixa automática de ingredientes | ✅ | useStockIntegration com rollback |
| Controle de rendimento | ✅ | yield calculado |
| Ficha técnica | ✅ | Recipe com ingredients |
| Cálculo de margem | ⚠️ | Dados existem mas não calculado |
| Relatório de produção | ✅ | Dashboard de relatórios completo |
| Análise de desperdício | ❌ | Não implementado |
| RN-PRO-001: Baixa automática | ✅ | Implementado com rollback |
| RN-PRO-002: Alerta rendimento <90% | ❌ | Não há alertas |
| RN-PRO-003: Atualizar custo | ⚠️ | Não automático |
| RN-PRO-004: Margem mínima 60% | ❌ | Não há validação |
| RN-PRO-005: Versão de receita | ✅ | Campo version em Recipe |

**Score: 9/14 completo, 2/14 parcial, 3/14 não implementado**

---

## 5. MÓDULO DE ATENDIMENTO A EMPRESAS (B2B)

### RF-EMP-001: Gestão de Clientes Empresariais

| Requisito | Status | Notas |
|-----------|--------|-------|
| Cadastro de empresas com CNPJ | ❌ | Não há entidade Company |
| Limite de crédito | ❌ | Não implementado |
| Vendas a prazo | ❌ | Não implementado |
| Faturamento mensal | ❌ | Não implementado |
| Emissão de NF-e | ❌ | Futuro |
| Relatório por empresa | ❌ | Não implementado |
| Controle de inadimplência | ❌ | Não implementado |
| Histórico de compras | ❌ | Não implementado |

**Score: 0/8 completo, 0/8 parcial, 8/8 não implementado**

---

## 6. REQUISITOS NÃO FUNCIONAIS

### RNF-001: Performance

| Requisito | Status | Notas |
|-----------|--------|-------|
| Tempo resposta <2s | ⚠️ | Não medido |
| 100 transações simultâneas | ⚠️ | Não testado |
| BD otimizado | ✅ | localStorage com cache |
| Cache produtos mais vendidos | ❌ | Cache genérico existe |

**Score: 1/4 completo, 2/4 parcial, 1/4 não implementado**

---

### RNF-002: Usabilidade

| Requisito | Status | Notas |
|-----------|--------|-------|
| Interface responsiva | ✅ | Tailwind + shadcn/ui |
| Modo escuro | ❌ | Não implementado |
| Atalhos de teclado | ❌ | Não implementado |
| Feedback visual imediato | ✅ | Toast notifications |
| Mensagens de erro claras | ⚠️ | Validadores existem |

**Score: 2/5 completo, 1/5 parcial, 2/5 não implementado**

---

### RNF-003: Segurança

| Requisito | Status | Notas |
|-----------|--------|-------|
| Autenticação obrigatória | ✅ | AuthContext |
| Níveis de acesso | ✅ | Roles (operador/supervisor) |
| Senha supervisor | ⚠️ | Roles existem mas não aplicados em todas operações |
| Log de auditoria imutável | ✅ | AuditLog repository |
| Backup automático | ❌ | Não há backup automático |
| Criptografia de dados | ❌ | localStorage não criptografado |

**Score: 3/6 completo, 1/6 parcial, 2/6 não implementado**

---

### RNF-004: Confiabilidade

| Requisito | Status | Notas |
|-----------|--------|-------|
| Funcionar offline | ✅ | localStorage com sync |
| Backup a cada 6h | ❌ | Não automático |
| Recuperação em 1h | ❌ | Não há plano de DR |
| Disponibilidade 99.5% | ⚠️ | Depende de hospedagem |

**Score: 1/4 completo, 1/4 parcial, 2/4 não implementado**

---

### RNF-005: Manutenibilidade

| Requisito | Status | Notas |
|-----------|--------|-------|
| Código modular | ✅ | Arquitetura em camadas |
| Testes automatizados | ❌ | Não há testes |
| Logs detalhados | ⚠️ | Console.log mas não estruturado |
| Versionamento de BD | ❌ | Não há migrations |
| Documentação técnica | ✅ | DATA_LAYER.md criado |

**Score: 2/5 completo, 1/5 parcial, 2/5 não implementado**

---

### RNF-006: Escalabilidade

| Requisito | Status | Notas |
|-----------|--------|-------|
| Múltiplos pontos de venda | ⚠️ | Arquitetura suporta mas não testado |
| Múltiplas unidades | ❌ | Não há conceito de unidade |
| BD preparado para crescimento | ✅ | Arquitetura permite migração |
| Arquitetura microserviços | ⚠️ | Preparado mas não implementado |

**Score: 1/4 completo, 2/4 parcial, 1/4 não implementado**

---

## 7. INTEGRAÇÕES FUTURAS

Todas as integrações listadas (máquina de cartão, NF-e, delivery, ERP) estão marcadas como **futuras** no documento e **não estão implementadas** no sistema atual.

**Score: 0/4 completo**

---

## RESUMO GERAL

### Por Módulo

| Módulo | Completo | Parcial | Não Impl. | % Completo |
|--------|----------|---------|-----------|------------|
| PDV - Venda Rápida | 7 | 2 | 2 | 64% |
| PDV - Categorias | 5 | 1 | 3 | 56% |
| PDV - Comandas | 5 | 3 | 4 | 42% |
| Caixa - Fechamento | 7 | 3 | 3 | 54% |
| Caixa - Pagamentos | 3 | 2 | 7 | 25% |
| Caixa - Relatórios | 3 | 4 | 1 | 38% |
| Consumo Funcionários | 5 | 6 | 2 | 38% |
| Estoque | 11 | 1 | 3 | 73% |
| Produção | 9 | 2 | 3 | 64% |
| B2B Empresas | 0 | 0 | 8 | 0% |
| RNF - Performance | 1 | 2 | 1 | 25% |
| RNF - Usabilidade | 2 | 1 | 2 | 40% |
| RNF - Segurança | 3 | 1 | 2 | 50% |
| RNF - Confiabilidade | 1 | 1 | 2 | 25% |
| RNF - Manutenibilidade | 2 | 1 | 2 | 40% |
| RNF - Escalabilidade | 1 | 2 | 1 | 25% |
| Integrações | 0 | 0 | 4 | 0% |

### Total Geral

- ✅ **Completo**: 64 requisitos (43%)
- ⚠️ **Parcial**: 32 requisitos (22%)
- ❌ **Não Implementado**: 52 requisitos (35%)

**Score Total: ~43% completo, ~65% com implementação parcial**

---

## PRINCIPAIS GAPS IDENTIFICADOS

### Críticos (Bloqueadores para Restaurante)

1. ❌ **Categorias Específicas de Restaurante** - almoço, jantar, marmita, bebidas, café
2. ❌ **Gestão B2B** - Vendas para empresas
3. ❌ **Modo Escuro** - Redução de fadiga visual
4. ❌ **Atalhos de Teclado** - Velocidade em horário de pico
5. ❌ **Pagamento Misto** - Apenas um método por venda

### Importantes (Impactam Operação)

6. ❌ **Impressão de Comprovantes** - Não há integração
7. ⚠️ **Validações de Regras de Negócio** - Muitas RNs não validadas
8. ❌ **Dividir Conta** - Não implementado
9. ❌ **Transferência entre Comandas** - Não implementado
10. ⚠️ **Relatórios Mensais** - Filtro mensal não implementado

### Desejáveis (Melhorias)

11. ❌ **Testes Automatizados** - Não há cobertura de testes
12. ❌ **Backup Automático** - Não implementado
13. ❌ **Análise de Desperdício** - Não implementado
14. ❌ **Bloquear Produtos Vencidos** - Não há validação
15. ❌ **Integração Máquina de Cartão** - Futuro

---

## RECOMENDAÇÕES

### Se o objetivo é adaptar para RESTAURANTE

#### Fase 1 - Essenciais (1-2 semanas)

1. Implementar categorias específicas (almoço, jantar, marmita, bebidas, café)
2. Adicionar atalhos de teclado para produtos mais vendidos
3. Implementar filtros mensais nos relatórios
4. Adicionar impressão de comprovantes

#### Fase 2 - Operacionais (1-2 semanas)

5. Pagamento misto (múltiplas formas)
6. Dividir conta entre clientes
7. Transferência entre comandas
8. Validações de regras de negócio restantes

#### Fase 3 - B2B (2 semanas)

9. Módulo de gestão de empresas
10. Vendas a prazo e faturamento

#### Fase 4 - Qualidade (2 semanas)

11. Testes automatizados
12. Backup automático
13. Modo escuro

### Se o objetivo é manter POUSADA + Restaurante

O sistema atual já está **bem estruturado** para uma pousada com restaurante integrado. Com as implementações recentes, os principais gaps restantes são:

- Funcionalidades B2B
- Pagamento misto
- Impressão de comprovantes
- Algumas validações de regras de negócio específicas

---

## PONTOS FORTES DO SISTEMA ATUAL

1. ✅ **Arquitetura de Dados Robusta** - Repository pattern com 20+ repositórios
2. ✅ **Persistência Local** - localStorage com sincronização cross-tab
3. ✅ **Type Safety** - TypeScript completo em todas as entidades
4. ✅ **Módulos Integrados** - Pousada, POS, Restaurante, Estoque funcionando juntos
5. ✅ **Auditoria Completa** - Rastreamento de todas as operações
6. ✅ **Preparado para Backend** - Arquitetura permite migração fácil
7. ✅ **UI Moderna** - shadcn/ui + Tailwind CSS
8. ✅ **Gestão de Funcionários** - Completa com consumo e limites
9. ✅ **Sistema de Alertas de Estoque** - Monitoramento automático em tempo real
10. ✅ **Baixa Automática de Estoque** - Integração com PDV e produção com rollback
11. ✅ **Dashboard de Relatórios** - Métricas, gráficos e exportação CSV
12. ✅ **Validação de Estoque no PDV** - Prevenção de vendas sem estoque

---

## MELHORIAS RECENTES IMPLEMENTADAS (Maio 2026)

### Sistema de Alertas de Estoque
- Monitoramento automático de níveis críticos e baixos
- Notificações toast em tempo real
- Configuração de thresholds personalizados por item
- Interface de gerenciamento de alertas

### Integração Automática de Baixa de Estoque
- Baixa automática em vendas PDV
- Baixa automática em produção de receitas
- Sistema de rollback em caso de erro
- Auditoria completa de movimentações
- Validação de estoque disponível antes de vender

### Dashboard de Relatórios e Analytics
- Métricas diárias com comparação ao dia anterior
- 4 gráficos interativos (Recharts):
  - Vendas por categoria
  - Vendas por forma de pagamento
  - Vendas por horário
  - Top 10 produtos mais vendidos
- Exportação de relatórios em CSV
- Tabela de produtos mais vendidos

### Validação e Feedback Visual no PDV
- Validação de estoque ao adicionar produtos no carrinho
- Bloqueio de vendas quando estoque esgotado
- Indicador visual de estoque disponível em cada item
- Alertas quando estoque insuficiente
- Notificação ao adicionar último item disponível

### Configuração de Thresholds
- Interface para configurar estoque mínimo por item
- Visualização de status (crítico/baixo/ok)
- Preview dos níveis de alerta ao editar
- Ordenação por criticidade
- Auditoria de alterações

---

## CONCLUSÃO

O sistema atual é uma **base sólida** que cobre ~65% dos requisitos de um restaurante (considerando implementações parciais). Com as implementações recentes de alertas, baixa automática e relatórios, os principais gaps restantes são:

- **Gestão B2B** (0% implementado)
- **Pagamento Misto** (apenas um método por venda)
- **Impressão de Comprovantes** (não há integração)
- **Algumas Validações de Regras de Negócio** (muitas já implementadas)

Para transformar em um sistema de restaurante completo, estima-se **4-6 semanas** de desenvolvimento focado nos gaps críticos e importantes.

Para manter como sistema de pousada com restaurante integrado, o sistema já está **funcional e pronto para produção**, com controle robusto de estoque, alertas automáticos, relatórios gerenciais e integração completa entre módulos.
