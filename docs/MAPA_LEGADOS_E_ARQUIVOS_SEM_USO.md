# Mapa de arquivos sem uso e resíduos de arquiteturas anteriores

Revisão em 22/10/2026, sobre o checkout local após `a020b75`. Nenhum arquivo funcional, variável de ambiente ou credencial foi alterado nesta revisão.

**Atualização:** a limpeza foi executada posteriormente. Consulte o [registro de execução e validação](LIMPEZA_REPOSITORIO.md). As listas abaixo preservam o diagnóstico anterior à limpeza.

## Resultado resumido

- Supabase não participa da aplicação atual: não há cliente, adaptador ou dependência do Supabase no código versionado atual.
- O `.env.local` ainda contém quatro variáveis do Supabase e uma variável antiga de senha do supervisor, sem referências no código/configuração versionados analisados.
- Foram analisados 489 arquivos versionados de código e CSS. O rastreamento encontrou **74 arquivos não alcançados** pelas entradas da aplicação, testes e ferramentas: **50 fora do restaurante** (34 componentes UI e 16 outros) e **24 no arquivo do restaurante**.
- Há ainda arquivos usados somente em testes ou ferramentas. Isso não os torna automaticamente inúteis.
- A separação do restaurante é incompleta: seis repositórios e operações do servidor continuam ligados ao núcleo. A pasta não pode ser apagada inteira sem refatorar esses vínculos.

## Método e limites

A análise percorreu imports, reexports, `require`, imports dinâmicos com caminho literal, imports de tipos e imports CSS. A resolução usou a API do TypeScript e o `tsconfig.json`, incluindo `@/`. As raízes foram arquivos do App Router, instrumentação, testes, scripts TypeScript e configurações de ferramentas. Depois foram verificadas referências textuais de variáveis de ambiente, ferramentas Docker/PowerShell, documentos e recursos públicos.

“Não alcançado” significa ausência de caminho a partir dessas entradas, mesmo que um arquivo seja importado por outro componente também abandonado. Não significa necessariamente ausência de qualquer referência textual. Imports de tipos foram conservadoramente considerados vínculos. Não foi medido o bundle final nem a execução de cada função; referências construídas dinamicamente e consumidores externos podem exigir revisão manual.

A análise de código sem uso não substitui testes de comportamento. Arquivos arquivados ainda podem ser verificados pelo TypeScript porque a configuração inclui `**/*.ts` e `**/*.tsx`; remover suas dependências sem ajustar esses arquivos pode quebrar a compilação.

## 1. Supabase e configurações locais

| Arquivo | Variável | Situação |
| --- | --- | --- |
| `.env.local:8` | `NEXT_PUBLIC_SUPABASE_URL` | Preenchida; sem referência no código atual |
| `.env.local:9` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preenchida; sem referência no código atual |
| `.env.local:14` | `SUPABASE_SERVICE_ROLE_KEY` | Preenchida; o JWT declara perfil `service_role`; sem referência no código atual |
| `.env.local:17` | `SUPABASE_DB_PASSWORD` | Preenchida; sem referência no código atual |
| `.env.local:5` | `NEXT_PUBLIC_SUPERVISOR_PASSWORD` | Configuração antiga; autenticação atual não a consulta |

Os valores não foram incluídos neste documento. Não houve tentativa de autenticar no Supabase ou validar se as credenciais ainda funcionam. Uma chave administrativa e uma senha devem ser tratadas como credenciais privadas mesmo sem uso neste aplicativo.

O `.env.local` não é rastreado e está coberto pelo `.gitignore`. Os arquivos `.env.demo.local` e `.env.docker.local` também são locais; suas variáveis têm referências nas ferramentas atuais e não devem ser limpas por associação com o Supabase. O `.dockerignore` exclui `.env*`, com exceção do exemplo público.

No histórico Git disponível localmente, não encontrei commits dos arquivos `.env`, `.env.local`, `.env.demo.local` ou `.env.docker.local`. Uma busca nos blobs textuais históricos não detectou JWTs com perfil `anon`/`service_role` nem chaves `sb_secret_` nos formatos pesquisados. Isso não certifica a ausência de todo tipo de segredo, nem cobre commits remotos não presentes no clone. Há histórico de arquivos de integração Supabase removidos, como `lib/supabase/client.ts`, o adaptador e scripts de instalação/migração; presença no histórico não significa uso atual.

**Ação sugerida:** remover essas cinco variáveis locais sem uso. Se a chave administrativa e a senha do projeto Supabase ainda forem válidas e o projeto não tiver outro consumidor, revogá-las/rotacioná-las no serviço. Apagar a linha do arquivo local não revoga uma credencial. Não há evidência nesta revisão que justifique reescrever o histórico Git.

## 2. Código fora da aplicação e das ferramentas

### 2.1 Candidatos fora do restaurante

| Arquivo/grupo | Motivo e alternativa atual |
| --- | --- |
| `components/admin-tab.tsx` | Alias antigo para `SettingsShell`, sem importadores alcançáveis; a navegação atual usa Configurações diretamente |
| `components/analytics-tab.tsx` | Tela antiga sem entrada na navegação; relatórios atuais usam `components/reports-tab.tsx` |
| `components/reports/period-selector.tsx` | Associado à tela antiga; o relatório atual usa `compact-period-selector.tsx` |
| `components/alert-badge.tsx` | Sem caminho de uso nas entradas analisadas |
| `lib/data/local-database-adapter.ts` | Adaptador antigo para JSONB `local_data_entries`; a aplicação atual usa API e tabelas relacionais |
| `lib/data/sync-manager.ts` | Gerenciador antigo de sincronização/last-write-wins, sem ligação com os fluxos atuais |
| `lib/hooks/useStockIntegration.ts`, `useProductStockIntegration.ts`, `usePOSStockValidation.ts` e `lib/utils/stock-sync.ts` | Camadas antigas de manipulação/sincronização de estoque sem chamada nas entradas atuais; conferir em conjunto, não reintroduzir no fluxo transacional |
| `lib/hooks/useBusinessRules.ts` | Sem chamada alcançável; a versão do restaurante também está arquivada |
| `lib/hooks/index.ts` | Barrel sem consumidores; alguns hooks exportados por ele ainda têm importadores diretos e testes |
| `lib/utils/auth.ts` | Utilitário antigo com hashes demonstrativos; autenticação operacional atual é de servidor, em `lib/server/auth.ts` |
| `lib/constants.ts` | Sem caminho de uso; não confundir com `lib/utils/constants.ts`, ainda usado |
| `hooks/use-mobile.ts` | Não usado; o layout atual usa `hooks/use-phone-layout.ts` |
| `styles/globals.css` | Folha antiga sem import; a folha ativa é `app/globals.css` |

Lista completa dos 16 arquivos acima:

- `components/admin-tab.tsx`
- `components/alert-badge.tsx`
- `components/analytics-tab.tsx`
- `components/reports/period-selector.tsx`
- `hooks/use-mobile.ts`
- `lib/constants.ts`
- `lib/data/local-database-adapter.ts`
- `lib/data/sync-manager.ts`
- `lib/hooks/index.ts`
- `lib/hooks/useBusinessRules.ts`
- `lib/hooks/usePOSStockValidation.ts`
- `lib/hooks/useProductStockIntegration.ts`
- `lib/hooks/useStockIntegration.ts`
- `lib/utils/auth.ts`
- `lib/utils/stock-sync.ts`
- `styles/globals.css`

### 2.2 Componentes UI disponíveis, mas sem uso alcançável

São componentes de biblioteca deixados no projeto. Não representam funcionalidades atuais. Podem ser removidos em uma tarefa de enxugamento; não é necessário manter toda a biblioteca pré-gerada.

- `components/ui/accordion.tsx`
- `components/ui/alert.tsx`
- `components/ui/aspect-ratio.tsx`
- `components/ui/avatar.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/button-group.tsx`
- `components/ui/carousel.tsx`
- `components/ui/confirmation-dialog.tsx`
- `components/ui/context-menu.tsx`
- `components/ui/drawer.tsx`
- `components/ui/empty.tsx`
- `components/ui/field.tsx`
- `components/ui/form.tsx`
- `components/ui/help-tooltip.tsx`
- `components/ui/hover-card.tsx`
- `components/ui/input-group.tsx`
- `components/ui/input-otp.tsx`
- `components/ui/item.tsx`
- `components/ui/kbd.tsx`
- `components/ui/menubar.tsx`
- `components/ui/navigation-menu.tsx`
- `components/ui/pagination.tsx`
- `components/ui/progress.tsx`
- `components/ui/radio-group.tsx`
- `components/ui/resizable.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/sidebar.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/slider.tsx`
- `components/ui/sonner.tsx`
- `components/ui/spinner.tsx`
- `components/ui/supervisor-approval-dialog.tsx`
- `components/ui/use-mobile.tsx`
- `components/ui/use-toast.ts`

Observações: `components/ui/use-toast.ts` é uma cópia sem uso; o caminho ativo é `hooks/use-toast.ts`. Os dois hooks antigos de detecção mobile não substituem o hook atual. Remover os componentes abaixo não autoriza remover todo pacote Radix: vários componentes ativos dependem de outros pacotes da mesma família.

## 3. Arquivo do restaurante: preservar e desacoplar

O cliente pediu explicitamente para manter o restaurante como módulo abandonado. Os 24 arquivos a seguir não são alcançados pelas entradas analisadas e pertencem a esse arquivo histórico:

- `modules/abandoned/restaurant/components/employee-consumption-modal.tsx`
- `modules/abandoned/restaurant/components/manage-employees-modal.tsx`
- `modules/abandoned/restaurant/components/manage-recipes-modal.tsx`
- `modules/abandoned/restaurant/components/manage-tables-modal.tsx`
- `modules/abandoned/restaurant/components/order-sheet.tsx`
- `modules/abandoned/restaurant/components/production-modal.tsx`
- `modules/abandoned/restaurant/components/restaurant-tab.tsx`
- `modules/abandoned/restaurant/components/stock/restaurant-products-tab.tsx`
- `modules/abandoned/restaurant/components/table-card.tsx`
- `modules/abandoned/restaurant/components/table-grid.tsx`
- `modules/abandoned/restaurant/hooks/useOrderManagement.ts`
- `modules/abandoned/restaurant/hooks/useProduction.ts`
- `modules/abandoned/restaurant/hooks/useTableManagement.ts`
- `modules/abandoned/restaurant/legacy/components/manage-categories-modal.tsx`
- `modules/abandoned/restaurant/legacy/components/reports-tab.tsx`
- `modules/abandoned/restaurant/legacy/components/reports/actions-sidebar.tsx`
- `modules/abandoned/restaurant/legacy/components/reports/export-dropdown-menu.tsx`
- `modules/abandoned/restaurant/legacy/components/stock/product-form-modal.tsx`
- `modules/abandoned/restaurant/legacy/lib/demo-data.ts`
- `modules/abandoned/restaurant/legacy/lib/hooks/useBusinessRules.ts`
- `modules/abandoned/restaurant/legacy/lib/hooks/useStockIntegration.ts`
- `modules/abandoned/restaurant/legacy/lib/server/notifications/rules.ts`
- `modules/abandoned/restaurant/legacy/scripts/seed-demo.ts`
- `modules/abandoned/restaurant/reports/restaurant-report.ts`

Porém, os seis arquivos em `modules/abandoned/restaurant/repositories/` continuam importados e reexportados em `lib/data/repositories/index.ts`. Também permanecem tipos e métodos em `lib/store.ts`, `lib/data/types.ts` e `lib/app-context.tsx`, mapeamentos em `lib/server/db/relational-data-service.ts`, operações em `lib/server/operations.ts` e modelos/permissões de restaurante.

Não são apenas arquivos mortos: há contratos e operações ainda compilados e acessíveis pelo servidor conforme permissões. A interface oculta não constitui remoção da capacidade do backend. Uma separação completa exige revisar APIs, contexto, exportação/importação, notificações, permissões e esquema. O arquivo pode ser preservado sem conservar seus vínculos no caminho ativo, mas isso deve ser uma tarefa própria, sem apagar a pasta solicitada pelo cliente.

## 4. Usados somente por testes, scripts ou infraestrutura

| Arquivo/grupo | Decisão |
| --- | --- |
| `lib/hooks/useCart.ts`, `useDiscount.ts`, `useGuestSearch.ts`, `usePayment.ts` | Sem uso na aplicação atual, mas com testes próprios; candidatos a retirar junto dos testes que cobrem apenas essas implementações antigas |
| `components/ui/date-display.tsx`, `payment-method-badge.tsx`, `stat-card.tsx`, `status-badge.tsx` | Consumidos por testes, sem uso no fluxo atual; revisar se serão adotados ou retirados |
| `lib/server/demo-seed.ts`, `scripts/seed-demo.ts` | Ativos como ferramenta da demonstração Docker; manter |
| `lib/server/env.ts` e `@next/env` | Usados pelos comandos fora do Next para carregar variáveis; manter |
| `prisma/seed.ts` | Cadastro inicial operacional; manter |
| `Dockerfile.backup` | É um Dockerfile do serviço de backup, referenciado no Compose; não é uma cópia antiga do Dockerfile |
| `pousada-menu.bat` e `scripts/server-panel*.ps1` | Instalação, painel e operação no Windows; manter |
| `compose.dev.yml`, `compose.demo.yml`, `compose.lan.yml`, `compose.https.yml` | Perfis distintos ainda usados pelas ferramentas; manter |
| Migrações Prisma e testes de migração | Histórico aplicado e validação do esquema; não apagar por serem antigos |
| `scripts/migrate-local-data.ts`, comando `db:migrate-local-data` e modelo `LocalDataEntry` | Resto da transição do JSONB. Não faz parte da operação relacional atual, mas ainda há um comando explícito. Como o app não entrou em produção, é candidato a retirar; remover a tabela/modelo exige migração nova, não reescrever migrações aplicadas |

## 5. Dependências

### Sem importação encontrada no código versionado

- `@vercel/analytics`: instalado, sem componente Analytics montado e sem imports. Candidato direto à remoção.
- `@hookform/resolvers`: sem imports encontrados. Candidato à remoção.
- `autoprefixer`: sem referência na configuração PostCSS ativa, que usa `@tailwindcss/postcss`. Candidato à remoção.
- `dotenv`: sem imports encontrados; o carregamento atual dos CLIs usa `@next/env`. Candidato à remoção.

`tsx` também não aparece em imports, mas é executado por scripts de inicialização, banco e workers; **manter**. `react-dom` é necessário ao React/Next mesmo sem um import manual na aplicação; **manter**. `prisma` e `@next/env` são ferramentas ativas, não dependências inúteis por estarem fora do grafo de páginas.

### Usadas apenas por componentes sem caminho ativo

A remoção depende de retirar/ajustar os componentes que ainda as importam, inclusive para a verificação de tipos:

- `@radix-ui/react-accordion`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`;
- `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`;
- `@radix-ui/react-navigation-menu`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`;
- `@radix-ui/react-scroll-area`, `@radix-ui/react-slider`;
- `embla-carousel-react`, `input-otp`, `react-hook-form`, `react-resizable-panels`, `vaul`.

A lista indica oportunidade de enxugamento, não impacto medido em memória ou tamanho do bundle.

## 6. Documentação e recursos sem função atual

- `docs/lacking_features.md`: requisitos do restaurante, incluindo sugestões de Supabase/Vercel; mover para o arquivo do restaurante, em vez de tratá-lo como requisito vigente.
- `docs/implementation_plan_1.md`: proposta anterior de Electron/Tauri e SQLite; arquivar como decisão substituída.
- `docs/implementation_plan_2.md`: migração para SQLite, substituída por PostgreSQL; arquivar.
- `TEST_SUMMARY.md`: declara 31 testes e não representa a suíte atual; atualizar ou arquivar.
- `REFACTORING.md`: relato histórico com contagem de 158 testes e fases anteriores; identificar como histórico, não status atual.
- `public/placeholder-logo.png`, `placeholder-logo.svg`, `placeholder-user.jpg`, `placeholder.jpg`, `placeholder.svg`, `icon-dark-32x32.png` e `icon-light-32x32.png`: sem referência encontrada na busca textual de código/configuração; revisar e retirar se não houver uso externo. Os ícones ativos `public/icon.png` e `public/apple-icon.png` são usados no layout.

Uma menção à Vercel em `docs/INSTALACAO_POUSADA.md` informa que ela **não participa** da implantação; não é uma conexão ativa e não deve ser removida como se fosse configuração. Planos, requisitos vigentes e relatórios de entrega não são código morto só por não terem imports.

## 7. Arquivos locais e gerados

- `dev.db`: arquivo local de 20.480 bytes, ignorado pelo Git, com nome de banco de desenvolvimento anterior. O Prisma atual declara `provider = "postgresql"`; não encontrei referência ao arquivo. Não foi aberto nem apagado nesta revisão.
- `.local/`, `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`: saídas de ferramentas, validações e dependências. Não fazem parte de uma limpeza de código versionado.
- `next-env.d.ts`: arquivo gerado pelo Next; a modificação local já existia antes da revisão e foi preservada.
- `backups/`, os arquivos `.env*` locais e `config/app.config.json`: dados/configuração locais. Não apagar em bloco para limpar o repositório.

## 8. Ordem de limpeza proposta

1. Retirar as cinco variáveis locais sem uso e tratar as credenciais Supabase no serviço caso ainda sejam válidas e desnecessárias.
2. Arquivar os documentos de SQLite/restaurante e corrigir as contagens de testes obsoletas.
3. Remover os candidatos de código sem uso, primeiro aliases, CSS duplicado e utilitários antigos; depois componentes UI e seus pacotes exclusivos. Validar imports, tipos, lint, testes e build em cada tarefa.
4. Retirar rotinas de migração JSONB que não serão usadas, com migração nova se houver alteração do esquema.
5. Desacoplar o restaurante do núcleo, preservando o código arquivado conforme o pedido do cliente.
6. Só então revisar a necessidade dos hooks e componentes usados exclusivamente por seus próprios testes.

A revisão produziu este mapa. Não foram removidas credenciais, dependências, código, dados ou arquivos de backup. Não foram feitas chamadas externas com as chaves encontradas.
