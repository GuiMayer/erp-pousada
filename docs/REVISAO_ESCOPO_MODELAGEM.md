# Auditoria da redução da modelagem

**Data:** 09/10/2026 · **Fonte:** [versão 0.3 integral](../modules/abandoned/restaurant/docs/REQUISITOS_POUSADA_E_RESTAURANTE.md) · **Destino:** [versão 0.5 ativa](REQUISITOS_E_MODELAGEM_ERP.md).

## Resultado

A redução da versão 0.4 foi excessiva: 20 requisitos PO e um diagrama agregado conservaram os temas, mas omitiram especificação para implementar e validar. A fonte original não foi apagada; estava arquivada. Esta revisão restaura o detalhamento necessário ao documento ativo e dá destino a todos os 130 requisitos numerados CAD/PRE/HOS/VEN/EMP/COM/EST/COZ/FIN/REL/ORG/QUA da fonte.

Contagem: Arquivado: 48; Mantido: 60; Adaptado: 18; Condicional mantido: 1; Evolução proposta: 2; Evolução mantida: 1. Nenhum requisito numerado foi deixado sem classificação. Essa auditoria documental não é homologação funcional do aplicativo.

## Seções não resumidas a requisitos

| Seção antiga | Destinação |
| --- | --- |
| 1–3: contexto, pesquisa e decisões D01–D24 | Decisões relevantes reescritas como DP-01–DP-12 e confirmações; pesquisa completa preservada. Decisões de cozinha, duas unidades e refeições arquivadas. |
| 4–6: telas e poderes | Inventário de superfícies da pousada e matriz de ações no documento ativo, incluindo cadastros/caixa/relatórios; não basta remover uma aba. |
| 7: entidades e cinco mapas | Quatro mapas ativos e dicionários para pessoas/preços, hospedagem, estoque/compra e financeiro. Mapa de restaurante e relações cruzadas arquivados. |
| 7.6–7.7: pontos de baixa e identidade | Invariantes, eventos e seção de migração ativos; consumo pertence à hospedagem, não ao quarto. |
| 9–11: fichas, fluxos e estados | T01–T09, nove fluxos e tabela de transições ativos, sem cozinha e contrato de refeições. |
| 12: cálculos | Tarifa por noite, saldo, custo, inventário, caixa e critérios de indicadores restaurados; fórmulas de buffet/fechamento de refeições arquivadas. |
| 13: qualidade | Todos os 20 QUA retomados; adaptar unidade/permissão, exemplos de tela e operação. |
| 14: A01–A39 | Cenários ativos AP-01–AP-35 preservam regras da pousada e acrescentam sucessão de hóspedes, checkout comum e origem. Cenários exclusivamente de restaurante arquivados; cartão e recorrência mantidos como evolução. |
| 15: perguntas ao cliente | Confirmações incorporadas; respostas do restaurante arquivadas. Não reabrir perguntas técnicas antes do protótipo. |
| 16: processo e rastreabilidade | Modelo lógico por fatia, critérios de conclusão e migração na seção 16; sprint detalhada liga requisitos e cenários. |
| 17: glossário e evidências | Evidências atuais verificadas e glossário mantidos; distinguidos esquema existente e alvo. |

## Distinções importantes

- A tarifa continua **por pessoa**, configurável por quarto e ocupação; a versão reduzida era ambígua ao descrevê-la apenas como faixa.
- Saída empresarial com dívida é alvo novo: o servidor atual ainda exige quitação. Documento não pode declarar o alvo como estado funcional existente.
- Cadastro com campo de validade não equivale a saldo por lote; cadastro de recorrência não equivale a gerador; gráfico POS não equivale a faturamento total da pousada.
- FIN-05 e FIN-11 mudaram de N para E por proposta de prioridade para cliente pequeno. Essa mudança é registrada e reversível na priorização; não foi disfarçada como remoção de restaurante.
- Os 20 PO da versão 0.4 continuam no índice do documento ativo. Os requisitos completos usam seus IDs de origem para permitir comparação.

## Destinação de cada requisito da fonte

| ID original | Tratamento | Destino/motivo |
| --- | --- | --- |
| ORG-01 | Arquivado | Separação entre dois negócios e escolha de unidade; pousada ativa é única. DP-01/escopo registram a simplificação. |
| ORG-02 | Arquivado | Separação entre dois negócios e escolha de unidade; pousada ativa é única. DP-01/escopo registram a simplificação. |
| ORG-03 | Arquivado | Separação entre dois negócios e escolha de unidade; pousada ativa é única. DP-01/escopo registram a simplificação. |
| CAD-01 | Mantido | CAD-01 no documento ativo; requisito detalhado recuperado. |
| CAD-02 | Mantido | CAD-02 no documento ativo; requisito detalhado recuperado. |
| CAD-03 | Adaptado | CAD-03 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| CAD-04 | Mantido | CAD-04 no documento ativo; requisito detalhado recuperado. |
| CAD-05 | Mantido | CAD-05 no documento ativo; requisito detalhado recuperado. |
| CAD-06 | Mantido | CAD-06 no documento ativo; requisito detalhado recuperado. |
| CAD-07 | Adaptado | CAD-07 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| CAD-08 | Adaptado | CAD-08 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| PRE-01 | Adaptado | PRE-01 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| PRE-02 | Adaptado | PRE-02 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| PRE-03 | Mantido | PRE-03 no documento ativo; requisito detalhado recuperado. |
| PRE-04 | Mantido | PRE-04 no documento ativo; requisito detalhado recuperado. |
| PRE-05 | Mantido | PRE-05 no documento ativo; requisito detalhado recuperado. |
| PRE-06 | Mantido | PRE-06 no documento ativo; requisito detalhado recuperado. |
| HOS-01 | Mantido | HOS-01 no documento ativo; requisito detalhado recuperado. |
| HOS-02 | Mantido | HOS-02 no documento ativo; requisito detalhado recuperado. |
| HOS-03 | Mantido | HOS-03 no documento ativo; requisito detalhado recuperado. |
| HOS-04 | Mantido | HOS-04 no documento ativo; requisito detalhado recuperado. |
| HOS-05 | Mantido | HOS-05 no documento ativo; requisito detalhado recuperado. |
| HOS-06 | Mantido | HOS-06 no documento ativo; requisito detalhado recuperado. |
| HOS-07 | Mantido | HOS-07 no documento ativo; requisito detalhado recuperado. |
| HOS-08 | Mantido | HOS-08 no documento ativo; requisito detalhado recuperado. |
| HOS-09 | Mantido | HOS-09 no documento ativo; requisito detalhado recuperado. |
| HOS-10 | Mantido | HOS-10 no documento ativo; requisito detalhado recuperado. |
| HOS-11 | Mantido | HOS-11 no documento ativo; requisito detalhado recuperado. |
| HOS-12 | Arquivado | Integração/cobrança do restaurante na hospedagem não integra o sistema ativo. |
| HOS-13 | Arquivado | Integração/cobrança do restaurante na hospedagem não integra o sistema ativo. |
| VEN-01 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-02 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-03 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-04 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-05 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-06 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-07 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-08 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-09 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-10 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-11 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-12 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-13 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-14 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-15 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| VEN-16 | Arquivado | Atendimento de restaurante saiu. Regras gerais de pagamento, preço e estorno continuam em PDV/PRE/FIN. |
| EMP-01 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-02 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-03 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-04 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-05 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-06 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-07 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-08 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-09 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-10 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-11 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-12 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-13 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-14 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-15 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| EMP-16 | Arquivado | Contrato e fornecimento de refeições saíram; cobrança empresarial de hospedagem permanece HOS-11/FIN. |
| COM-01 | Adaptado | COM-01 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| COM-02 | Mantido | COM-02 no documento ativo; requisito detalhado recuperado. |
| COM-03 | Adaptado | COM-03 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| COM-04 | Mantido | COM-04 no documento ativo; requisito detalhado recuperado. |
| COM-05 | Condicional mantido | COM-05 permanece C; escopo de primeira entrega depende do uso real no protótipo. |
| COM-06 | Mantido | COM-06 no documento ativo; requisito detalhado recuperado. |
| COM-07 | Mantido | COM-07 no documento ativo; requisito detalhado recuperado. |
| COM-08 | Mantido | COM-08 no documento ativo; requisito detalhado recuperado. |
| COM-09 | Mantido | COM-09 no documento ativo; requisito detalhado recuperado. |
| EST-01 | Adaptado | EST-01 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| EST-02 | Adaptado | EST-02 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| EST-03 | Mantido | EST-03 no documento ativo; requisito detalhado recuperado. |
| EST-04 | Mantido | EST-04 no documento ativo; requisito detalhado recuperado. |
| EST-05 | Mantido | EST-05 no documento ativo; requisito detalhado recuperado. |
| EST-06 | Mantido | EST-06 no documento ativo; requisito detalhado recuperado. |
| EST-07 | Mantido | EST-07 no documento ativo; requisito detalhado recuperado. |
| EST-08 | Arquivado | Transferência de estoque entre negócios fora do escopo; há apenas estoque de bebidas. |
| EST-09 | Mantido | EST-09 no documento ativo; requisito detalhado recuperado. |
| EST-10 | Mantido | EST-10 no documento ativo; requisito detalhado recuperado. |
| COZ-01 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-02 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-03 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-04 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-05 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-06 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-07 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| COZ-08 | Arquivado | Cozinha, produção e consumo de funcionário fora do escopo. |
| FIN-01 | Adaptado | FIN-01 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| FIN-02 | Mantido | FIN-02 no documento ativo; requisito detalhado recuperado. |
| FIN-03 | Mantido | FIN-03 no documento ativo; requisito detalhado recuperado. |
| FIN-04 | Mantido | FIN-04 no documento ativo; requisito detalhado recuperado. |
| FIN-05 | Evolução proposta | FIN-05 preservado como E: agenda de repasses/geração de recorrência não bloqueiam o primeiro protótipo; decisão de prioridade explícita, sem alegar confirmação do cliente. |
| FIN-06 | Mantido | FIN-06 no documento ativo; requisito detalhado recuperado. |
| FIN-07 | Mantido | FIN-07 no documento ativo; requisito detalhado recuperado. |
| FIN-08 | Mantido | FIN-08 no documento ativo; requisito detalhado recuperado. |
| FIN-09 | Adaptado | FIN-09 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| FIN-10 | Evolução mantida | FIN-10 permanece E, sem exclusão da regra; não bloqueia núcleo. |
| FIN-11 | Evolução proposta | FIN-11 preservado como E: agenda de repasses/geração de recorrência não bloqueiam o primeiro protótipo; decisão de prioridade explícita, sem alegar confirmação do cliente. |
| FIN-12 | Adaptado | FIN-12 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| FIN-13 | Mantido | FIN-13 no documento ativo; requisito detalhado recuperado. |
| FIN-14 | Arquivado | Rateio entre pousada e restaurante fora do escopo. Despesas da pousada permanecem FIN. |
| REL-01 | Mantido | REL-01 no documento ativo; requisito detalhado recuperado. |
| REL-02 | Arquivado | Relatórios de canais do restaurante fora do escopo. |
| REL-03 | Mantido | REL-03 no documento ativo; requisito detalhado recuperado. |
| REL-04 | Adaptado | REL-04 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| REL-05 | Adaptado | REL-05 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| REL-06 | Adaptado | REL-06 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| REL-07 | Mantido | REL-07 no documento ativo; rastreabilidade e estimativas preservadas, removida referência a ficha de cozinha. |
| QUA-01 | Mantido | QUA-01 no documento ativo; requisito detalhado recuperado. |
| QUA-02 | Mantido | QUA-02 no documento ativo; requisito detalhado recuperado. |
| QUA-03 | Mantido | QUA-03 no documento ativo; requisito detalhado recuperado. |
| QUA-04 | Adaptado | QUA-04 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| QUA-05 | Adaptado | QUA-05 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| QUA-06 | Mantido | QUA-06 no documento ativo; requisito detalhado recuperado. |
| QUA-07 | Mantido | QUA-07 no documento ativo; requisito detalhado recuperado. |
| QUA-08 | Mantido | QUA-08 no documento ativo; requisito detalhado recuperado. |
| QUA-09 | Mantido | QUA-09 no documento ativo; requisito detalhado recuperado. |
| QUA-10 | Adaptado | QUA-10 no documento ativo; remover dependência de restaurante/unidades ou esclarecer vínculo, preservando a regra aplicável. |
| QUA-11 | Mantido | QUA-11 no documento ativo; requisito detalhado recuperado. |
| QUA-12 | Mantido | QUA-12 no documento ativo; requisito detalhado recuperado. |
| QUA-13 | Mantido | QUA-13 no documento ativo; requisito detalhado recuperado. |
| QUA-14 | Mantido | QUA-14 no documento ativo; requisito detalhado recuperado. |
| QUA-15 | Mantido | QUA-15 no documento ativo; requisito detalhado recuperado. |
| QUA-16 | Mantido | QUA-16 no documento ativo; requisito detalhado recuperado. |
| QUA-17 | Mantido | QUA-17 no documento ativo; requisito detalhado recuperado. |
| QUA-18 | Mantido | QUA-18 no documento ativo; requisito detalhado recuperado. |
| QUA-19 | Mantido | QUA-19 no documento ativo; requisito detalhado recuperado. |
| QUA-20 | Mantido | QUA-20 no documento ativo; requisito detalhado recuperado. |
