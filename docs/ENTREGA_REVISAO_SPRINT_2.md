# Entrega — Sprint 2 da revisão de usabilidade

**Data:** 22/10/2026. Implementação do plano de revisão, com commits por tarefa. A sprint funcional 2 de hospedagem é uma entrega anterior; este documento trata da revisão de interface.

## O que mudou

| Etapa | Entrega |
| --- | --- |
| Cabeçalhos e sub-abas | Cabeçalho compartilhado em Cadastros, Estoque, Financeiro, Relatórios e Histórico. Títulos do módulo não são repetidos no celular. Sub-abas usam o mesmo padrão com foco, hover, teclado e rolagem horizontal em telas estreitas. Configurações conserva sua lateral com busca. |
| Auditoria | Filtros com largura adaptável e nomes acessíveis. Badges contrastantes nos dois temas. Ação visível Ver detalhes, expansão por teclado e texto explícito quando não existem detalhes. Antes/depois usam rótulos compreensíveis, valores monetários localizados e sanitização de segredos. |
| Gráficos | Identificadores de dinheiro, débito, crédito, PIX e hospedagem têm uma correspondência única com rótulo e cor. Nomes equivalentes são agrupados em centavos. Pizza com raio proporcional à área e legenda fora do desenho. Quatro formas comuns continuam identificadas quando o valor é zero; período vazio tem mensagem própria. |
| Datas | Campo compartilhado com digitação dd/mm/aaaa e calendário pt-BR nos filtros de Histórico, Auditoria, Relatórios e Financeiro. Validação de datas inexistentes, mínimo/máximo, limpeza e seleção sem conversão de dia comercial em instante UTC. Rótulos de navegação do calendário também estão em português. Os intervalos de diárias conservam o formato específico já solicitado. |
| Consumo | Catálogo sem teto fixo de 192 px, uma área central de rolagem e rodapé de pagamento acessível. Nome completo da conta selecionada aparece por extenso. Em janelas com até 600 px de altura, o painel inteiro rola para que catálogo e pagamento continuem alcançáveis. Padding, campos preenchidos, abertura de caixa e regras de entrega/recebimento foram preservados. |
| Ações e textos | Produto do PDV usa ícone de adicionar, nome acessível contextual e anúncio discreto da quantidade no carrinho. Revisão de acentos nos controles e nos exemplos de bebidas; dados livres dos clientes não são alterados. Aviso de saldo interno/conciliação usa texto legível. |

O resumo dos quartos continua sempre e somente no Mapa, abaixo da navegação principal. O restaurante permanece arquivado. Não houve mudança nas regras de autorização, cobrança, baixa de estoque ou cancelamento.

## Segurança

As tarefas de dependências foram separadas dos commits da interface: Next.js 16.4.2 e DOMPurify 3.4.17; ferramentas de desenvolvimento também atualizadas. A auditoria das dependências de produção passou sem alertas. A auditoria completa ainda identifica um alerta alto de braces na cadeia de lint, sem versão corrigida publicada. Ele não foi ocultado nem apresentado como resolvido. Consulte [o registro de segurança](SEGURANCA_DEPENDENCIAS.md).

## Validação

- Suíte completa: **479 testes aprovados em 78 arquivos**. Depois dessa execução, foi acrescentado um cenário de conta bancária longa; os seis testes do arquivo de consumo passaram, incluindo a preservação da seleção ao pesquisar uma bebida.
- **105 testes de integração aprovados em seis arquivos**, usando somente PostgreSQL isolado erp_test. Cobrem pagamentos/consumo/estoque, relatórios, permissões, segurança operacional, auditoria e notificações. O banco isolado foi desligado ao término.
- Após o acabamento, **32 testes dirigidos em sete arquivos** foram aprovados, cobrindo também os novos rótulos e acentos.
- Tipos, lint sem avisos e build de produção conferidos. A compilação usa diretório isolado e restaura os arquivos gerados de configuração, preservando o ambiente de desenvolvimento.
- Testes dos controles: nomes equivalentes dos meios de cobrança, cores distintas de débito/crédito, ausência de dados, datas impossíveis e viradas de mês, calendário independente do idioma en-US, filtros financeiros, permissões e preservação dos campos de consumo ao abrir o caixa.
- Conferência visual anterior à retomada: 1366 × 768 e 1280 × 720 no desktop; 390 × 844 e 360 × 800 no celular, com temas claro e escuro distribuídos entre os cenários. Foram conferidos filtros e expansão da auditoria, calendário em português, sub-abas, pizza completa com legenda e consumo com rodapé legível.
- Navegação por setas entre as sub-abas foi exercitada no navegador e manteve o painel ativo corretamente identificado.
- O navegador automatizado não aplicou o atalho de zoom; foi exercitada uma janela de **640 × 360**, equivalente à área CSS disponível a 200% em 1280 × 720, para verificar a rolagem do consumo. Isso não substitui a homologação manual com zoom real de 200%.
- Na retomada, o acesso ao navegador foi bloqueado pela política da ferramenta. Não houve tentativa de contornar o bloqueio; não foi possível repetir a captura final nem concluir a matriz completa de cada tela em todos os tamanhos/temas. As observações visuais acima correspondem às verificações efetivamente realizadas.

Os registros técnicos estão na pasta local ignorada .local, incluindo s2-full-acceptance.log, s2-integration-acceptance.log, s2-long-account.log e os logs de validação final. Nenhum teste visual aqui é apresentado como aceite do cliente.

## Continuidade

A implementação da [Sprint 3 foi entregue](ENTREGA_REVISAO_SPRINT_3.md): filtros/busca e volume de reservas, WhatsApp por ação explícita, medição técnica e roteiro dos fluxos diários. O aceite da recepção e a homologação visual completa continuam pendentes. A matriz visual completa e o zoom real de 200% devem ser confirmados nessa homologação. Nenhum push ou deploy foi executado nesta entrega.
