# Restaurante — módulo abandonado

Em 09/10/2026, o cliente contratou outro sistema para o restaurante. Este módulo saiu do escopo do ERP Pousada e está preservado como referência, sem entrada na interface e sem compromisso de manutenção funcional.

## Conteúdo preservado

- `components/`: mesas, comandas, cardápio, receitas, produção e consumo de funcionários.
- `hooks/`: atendimento, comandas e produção.
- `repositories/`: acesso às entidades específicas do restaurante.
- `reports/`: relatório de restaurante.
- `legacy/`: versões compartilhadas anteriores à separação, incluindo formulários, exportações, regras e exemplos de demonstração. São referências arquivadas, sem montagem no aplicativo ativo.
- `docs/`: modelagem completa anterior, captura da tela e respostas do cliente.

## Limite da separação

A aplicação ativa mantém hospedagem, Frente de Caixa para bebidas, estoque, financeiro, relatórios, configurações, usuários e auditoria. Cardápio, mesas, comandas, fichas de receita, cozinha e consumo de funcionários saíram da navegação, dos formulários ativos, das exportações e das preferências de alerta.

O estoque e o catálogo ativos excluem produtos de categorias com `isRestaurant: true`. Produtos sem categoria conhecida continuam acessíveis para não ocultar cadastros legados por engano; devem ser classificados manualmente caso necessário. Não há classificação por nome do produto.

Os modelos Prisma, os tipos, as permissões de servidor, os métodos de compatibilidade do contexto e as operações transacionais existentes permanecem no núcleo. Os repositórios arquivados ainda são expostos pelo índice de dados para preservar contratos internos. O carregamento normal da interface não consulta as seis coleções exclusivas do restaurante. Não houve exclusão de registros nem migração destrutiva; transações históricas continuam disponíveis no financeiro e na auditoria.

Esta pasta **não é um plugin ativável**. Reativar o módulo exigiria revisar carregamento de dados, permissões, regras, telas e testes. As APIs de compatibilidade continuam sujeitas à autenticação e às permissões existentes; ocultar um módulo não substitui esse controle.

As credenciais dos exemplos arquivados não devem ser usadas para instalação operacional. A demonstração ativa continua separada do banco normal.
