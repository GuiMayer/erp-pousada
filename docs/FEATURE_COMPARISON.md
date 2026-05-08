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
| Relatório Diário completo | ❌ | Dados existem mas UI não implementada |
| Relatório Mensal completo | ❌ | Dados existem mas UI não implementada |
| Filtros por período | ❌ | Não há interface |
| Filtros por categoria | ❌ | Não há interface |
| Exportação PDF/Excel | ❌ | Não implementado |
| Gráficos visuais | ❌ | Não há biblioteca |
| Impressão direta | ❌ | Não implementado |
| Envio por email | ❌ | Não implementado |

**Score: 0/8 completo, 0/8 parcial, 8/8 não implementado**

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
| Baixa automática em vendas | ⚠️ | Estrutura existe mas não automático |
| Estoque mínimo com alertas | ⚠️ | minimumStock existe mas sem alertas |
| Controle de validade | ✅ | expirationDate em StockMovement |
| Inventário com ajustes | ✅ | StockMovement tipo 'ajuste' |
| Relatório de movimentação | ⚠️ | Dados existem mas UI não implementada |
| Relatório próximo vencimento | ❌ | Não há relatório |
| Custo médio ponderado (CMV) | ✅ | averageCost em StockItem |
| RN-EST-001: Estoque não negativo | ⚠️ | Não há validação |
| RN-EST-002: Alerta estoque mínimo | ❌ | Não há alertas |
| RN-EST-003: Bloquear vencidos | ❌ | Não há validação |
| RN-EST-004: Ajuste com justificativa | ✅ | Campo reason obrigatório |
| RN-EST-005: Entrada com nota fiscal | ⚠️ | Campo existe mas não obrigatório |

**Score: 6/15 completo, 6/15 parcial, 3/15 não implementado**

---

### RF-EST-002: Controle de Produção

| Requisito | Status | Notas |
|-----------|--------|-------|
| Cadastro de receitas | ✅ | Recipe completo |
| Cálculo automático de custo | ✅ | Soma de ingredientes |
| Registro de produção | ✅ | Production repository |
| Baixa automática de ingredientes | ⚠️ | Estrutura existe mas não automático |
| Controle de rendimento | ✅ | yield calculado |
| Ficha técnica | ✅ | Recipe com ingredients |
| Cálculo de margem | ⚠️ | Dados existem mas não calculado |
| Relatório de produção | ⚠️ | Dados existem mas UI não implementada |
| Análise de desperdício | ❌ | Não implementado |
| RN-PRO-001: Baixa automática | ⚠️ | Não automático |
| RN-PRO-002: Alerta rendimento <90% | ❌ | Não há alertas |
| RN-PRO-003: Atualizar custo | ⚠️ | Não automático |
| RN-PRO-004: Margem mínima 60% | ❌ | Não há validação |
| RN-PRO-005: Versão de receita | ✅ | Campo version em Recipe |

**Score: 6/14 completo, 5/14 parcial, 3/14 não implementado**

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
| Caixa - Relatórios | 0 | 0 | 8 | 0% |
| Consumo Funcionários | 5 | 6 | 2 | 38% |
| Estoque | 6 | 6 | 3 | 40% |
| Produção | 6 | 5 | 3 | 43% |
| B2B Empresas | 0 | 0 | 8 | 0% |
| RNF - Performance | 1 | 2 | 1 | 25% |
| RNF - Usabilidade | 2 | 1 | 2 | 40% |
| RNF - Segurança | 3 | 1 | 2 | 50% |
| RNF - Confiabilidade | 1 | 1 | 2 | 25% |
| RNF - Manutenibilidade | 2 | 1 | 2 | 40% |
| RNF - Escalabilidade | 1 | 2 | 1 | 25% |
| Integrações | 0 | 0 | 4 | 0% |

### Total Geral

- ✅ **Completo**: 53 requisitos (36%)
- ⚠️ **Parcial**: 36 requisitos (24%)
- ❌ **Não Implementado**: 59 requisitos (40%)

**Score Total: ~36% completo, ~60% com implementação parcial**

---

## PRINCIPAIS GAPS IDENTIFICADOS

### Críticos (Bloqueadores para Restaurante)

1. ❌ **Relatórios Diários/Mensais** - Essencial para gestão
2. ❌ **Categorias Específicas de Restaurante** - almoço, jantar, marmita, bebidas, café
3. ❌ **Gestão B2B** - Vendas para empresas
4. ❌ **Modo Escuro** - Redução de fadiga visual
5. ❌ **Atalhos de Teclado** - Velocidade em horário de pico

### Importantes (Impactam Operação)

6. ⚠️ **Baixa Automática de Estoque** - Existe estrutura mas não automático
7. ⚠️ **Alertas de Estoque Mínimo** - Dados existem mas sem alertas
8. ⚠️ **Validações de Regras de Negócio** - Muitas RNs não validadas
9. ❌ **Pagamento Misto** - Apenas um método por venda
10. ❌ **Impressão de Comprovantes** - Não há integração

### Desejáveis (Melhorias)

11. ❌ **Testes Automatizados** - Não há cobertura de testes
12. ❌ **Backup Automático** - Não implementado
13. ❌ **Dividir Conta** - Não implementado
14. ❌ **Transferência entre Comandas** - Não implementado
15. ❌ **Análise de Desperdício** - Não implementado

---

## RECOMENDAÇÕES

### Se o objetivo é adaptar para RESTAURANTE

#### Fase 1 - Essenciais (2-3 semanas)

1. Implementar categorias específicas (almoço, jantar, marmita, bebidas, café)
2. Criar módulo de relatórios diários/mensais
3. Adicionar atalhos de teclado para produtos mais vendidos
4. Implementar alertas automáticos (estoque, caixa, comandas)

#### Fase 2 - Operacionais (2-3 semanas)

5. Baixa automática de estoque em vendas
6. Pagamento misto (múltiplas formas)
7. Impressão de comprovantes
8. Validações de regras de negócio

#### Fase 3 - B2B (2 semanas)

9. Módulo de gestão de empresas
10. Vendas a prazo e faturamento

#### Fase 4 - Qualidade (2 semanas)

11. Testes automatizados
12. Backup automático
13. Modo escuro

### Se o objetivo é manter POUSADA + Restaurante

O sistema atual já está **bem estruturado** para uma pousada com restaurante integrado. Os gaps são principalmente:

- Relatórios gerenciais
- Automações (baixa de estoque, alertas)
- Validações de regras de negócio
- Funcionalidades B2B

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

---

## CONCLUSÃO

O sistema atual é uma **base sólida** que cobre ~60% dos requisitos de um restaurante (considerando implementações parciais). Os principais gaps são:

- **Relatórios e Analytics** (0% implementado)
- **Gestão B2B** (0% implementado)
- **Automações e Alertas** (estrutura existe mas não ativo)
- **Validações de Regras de Negócio** (muitas não aplicadas)

Para transformar em um sistema de restaurante completo, estima-se **6-8 semanas** de desenvolvimento focado nos gaps críticos e importantes.

Para manter como sistema de pousada com restaurante integrado, o sistema já está **funcional e pronto para produção**, necessitando apenas melhorias incrementais em relatórios e automações.
