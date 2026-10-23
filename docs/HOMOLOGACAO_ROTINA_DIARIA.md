# Homologação da rotina diária da pousada

**Ambiente:** demonstração ou erp_test isolado, nunca o banco operacional. **Responsáveis pelo aceite:** usuário e uma pessoa da recepção. A automação técnica não substitui esse aceite.

## Como medir

Usar o mesmo computador, tamanho de tela, perfil e cenário na comparação. Contar cliques e preenchimentos separadamente. Cronometrar do primeiro comando até a confirmação visível e registrar as esperas de rede/servidor à parte. Não fixar uma meta de segundos antes da primeira observação real. Repetir um cenário quando houver erro do roteiro ou interrupção externa, anotando o motivo.

A Sprint 3 preserva as etapas financeiras aprovadas. O ganho principal está na localização das reservas. A referência anterior é o commit 855a3bb, antes da implementação desta sprint; não é necessário trocar o sistema de quem está atendendo para medir isso. A comparação técnica da lista usa o seletor original preservado no código e dados fictícios equivalentes.

| Cenário | Resultado esperado | Cliques / campos | Tempo total / espera | Resultado da recepção |
| --- | --- | --- | --- | --- |
| Buscar última reserva entre 200 | Busca por referência identifica o atendimento sem percorrer todas as linhas. Limpar restaura a consulta. | A preencher | A preencher | Pendente |
| Grupo com um quarto no filtro | A linha informa correspondências e mantém todos os quartos. A ação usa ID/versão do quarto escolhido. | A preencher | A preencher | Pendente |
| Nova reserva com dois quartos | Hóspede, pagador, ocupação e preços são revistos uma vez; quartos vinculados, atendimentos individuais. | A preencher | A preencher | Pendente |
| Check-in com reserva | Identidade e preço vêm preenchidos; entrada hoje ou anterior autorizada. Futuro permanece reserva. | A preencher | A preencher | Pendente |
| Check-in sem reserva | Entrada direta reutiliza cadastro e tarifa; recebimento inicial é opcional. | A preencher | A preencher | Pendente |
| Empresa ou particular | Pessoa com vínculo sugere empresa e permite pagar por conta própria sem alterar o vínculo cadastral. | A preencher | A preencher | Pendente |
| Cancelamento sem sinal | Motivo opcional; nenhum estorno financeiro inventado. | A preencher | A preencher | Pendente |
| Cancelamento com sinal | Supervisor autorizado escolhe devolver ou reter; retenção com justificativa; uma única movimentação por decisão. | A preencher | A preencher | Pendente |
| Bebida quitada na hora | Uma baixa de estoque; valor não vira dívida da hospedagem. | A preencher | A preencher | Pendente |
| Bebida lançada na ficha | Uma entrega/baixa; dívida aparece na ficha; recebimento posterior não baixa estoque de novo. | A preencher | A preencher | Pendente |
| Pagamento parcial e misto | Só o saldo restante fica em aberto; troco não vira receita; uma aplicação por meio. | A preencher | A preencher | Pendente |
| Check-out particular | Saldo quitado; nenhuma cobrança automática duplicada de bebida ou diária. | A preencher | A preencher | Pendente |
| Check-out empresarial a prazo | Empresa pagadora e autorização exigidas; título identificado pela hospedagem, com vencimento. | A preencher | A preencher | Pendente |
| Abrir/fechar caixa | Operação pela Frente de Caixa; conveniência no consumo preserva campos; contagem e diferença justificadas. | A preencher | A preencher | Pendente |
| Caixa fechado por outro usuário | Confirmação antiga é recusada sem receber parcialmente; após regularizar, operador pode tentar novamente. | A preencher | A preencher | Pendente |
| Reenvio após perda de resposta | A mesma operação é reapresentada; servidor não duplica venda, recebimento, saída ou estoque. | A preencher | A preencher | Pendente |
| Dois usuários no mesmo atendimento | Só uma versão vence; o segundo revisa os dados atualizados. | A preencher | A preencher | Pendente |
| Contato | Número do hóspede, DDI visível, cópia funcional ou alternativa de seleção; WhatsApp só por clique. Sem telefone, atendimento segue. | A preencher | A preencher | Pendente |

## Conferência visual e acessibilidade

Conferir Mapa, Reservas, detalhes de grupo e consumo em 1366 × 768, 1280 × 720, 390 × 844 e 360 × 800, nos dois temas. Testar zoom real de 200%, teclado, foco e textos longos. Configurações conserva a lateral. Verificar o nome acessível do check-in, a indicação de quartos fora do filtro, a paginação e o retorno após limpar filtros.

Na execução automatizada anterior, o navegador recusou acesso pela política da ferramenta. Esta entrega não declara concluída a matriz visual completa ou o zoom real. Executar esta parte antes do aceite final.

## Critério de aceite

Nenhuma alteração de saldo/estoque sem origem e autorização; nenhuma ação aplicada a outro quarto; nenhum registro concluído reaparece em Reservas. Anotar gargalos reais antes de remover confirmações financeiras ou controles de segurança. Aprovação da recepção: **pendente**. Observações, data e responsável: **a preencher**.
