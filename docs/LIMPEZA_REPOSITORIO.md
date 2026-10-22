# Limpeza do repositório — 22/10/2026

Execução do [mapa de arquivos sem uso](MAPA_LEGADOS_E_ARQUIVOS_SEM_USO.md). O mapa original registra o estado anterior à limpeza.

## Configuração local

Foram removidas do `.env.local` as variáveis sem consumidores `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` e `NEXT_PUBLIC_SUPERVISOR_PASSWORD`, além dos comentários locais específicos do Supabase. Os valores não foram copiados para este documento, backups ou commits.

O arquivo continua ignorado pelo Git. Este commit registra a limpeza sem versionar o ambiente local. As configurações de PostgreSQL, demonstração, Docker e autenticação atuais foram preservadas. Excluir uma variável local não revoga a credencial no serviço externo; não foram realizadas operações na conta Supabase.

## Documentação

Os planos de SQLite/Electron e os relatos antigos de testes/refatoração foram movidos para `docs/history/`, com aviso histórico. Os requisitos e a comparação antiga do restaurante foram movidos para `modules/abandoned/restaurant/docs/`. O conteúdo foi preservado, e o link do README foi atualizado. Os requisitos, sprints, guias de operação e relatórios atuais permanecem nas localizações existentes.

## Código substituído

Foram retirados aliases e telas sem entrada ativa, a folha CSS duplicada, utilitários antigos de autenticação/sincronização/estoque, o adaptador JSONB e seu comando de conversão. Os quatro hooks de carrinho, desconto, busca de hóspedes e pagamento sem uso foram removidos com os testes exclusivos dessas implementações. A autenticação, estoque transacional, sincronização atual, importação inicial e restauração continuam nos fluxos atuais. O esquema e as migrações aplicadas foram preservados.

## Interface e recursos

Foram removidos os componentes UI não usados, as cópias antigas de toast/mobile e quatro componentes com testes exclusivos, além de sete imagens placeholder/ícones sem referências. Os componentes `accordion`, `confirmation-dialog` e `scroll-area` foram preservados por terem consumidores no restaurante arquivado. Ícones ativos, biblioteca efetivamente usada, componentes compartilhados e telas atuais foram mantidos. Foram retirados somente os testes exclusivos dos componentes removidos; os testes dos fluxos atuais permanecem.

## Dependências

Foram removidas 18 dependências diretas sem consumidores restantes, com atualização do `pnpm-lock.yaml`: `@hookform/resolvers`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-slider`, `@vercel/analytics`, `autoprefixer`, `dotenv`, `embla-carousel-react`, `input-otp`, `react-hook-form`, `react-resizable-panels` e `vaul`.

`tsx`, `react-dom`, `@next/env`, Prisma, Sonner e os pacotes de acordeão/rolagem foram mantidos por terem consumidores ou função nas ferramentas e no restaurante preservado. O gerenciador retirou 24 pacotes instalados ao resolver também as dependências transitivas; pacotes que continuam necessários transitivamente podem permanecer no lockfile.

## Balanço e validação

- 71 arquivos retirados: 56 fontes/folhas de estilo/scripts sem função atual, oito arquivos de testes exclusivos das implementações retiradas e sete recursos de imagem sem referências.
- Seis documentos movidos para áreas históricas, preservando seu conteúdo e identificando o estado histórico.
- O restaurante existente foi preservado. Somente dois documentos de restaurante foram acrescentados ao seu arquivo; os componentes, hooks, repositórios, relatórios e fontes anteriores não foram apagados ou alterados.
- Tipos, lint e build de produção aprovados. Instalação com `--frozen-lockfile --ignore-scripts` aprovada.
- Suíte atual: 448 testes em 69 arquivos aprovados. A diferença de 63 testes decorre da retirada dos oito arquivos que testavam exclusivamente os hooks e componentes desativados; os testes dos fluxos atuais foram mantidos.
- A página de desenvolvimento respondeu HTTP 200 após a retirada das dependências.

Não houve migração, acesso a banco operacional, alteração de esquema, exclusão de backups ou reescrita de histórico Git. A tabela histórica `local_data_entries` e as migrações aplicadas foram preservadas; uma eventual exclusão desse objeto deve ser tratada por migração própria. Os problemas de consumo da demonstração documentados na revisão anterior continuam sendo uma tarefa funcional separada desta limpeza.
