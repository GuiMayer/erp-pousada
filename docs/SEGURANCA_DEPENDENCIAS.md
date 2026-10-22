# Dependências — verificação de segurança

Verificação em 22/10/2026. Este registro é um resultado pontual da auditoria, não uma garantia permanente de ausência de vulnerabilidades.

## Produção

- Next.js, @next/env e eslint-config-next: 16.4.2.
- DOMPurify transitivo do jsPDF: 3.4.17, resolvido no lockfile sem adicionar dependência direta ou manter fork.
- `pnpm audit --prod`: nenhum alerta conhecido, incluindo dependências opcionais. Geração de PDF conferida.

Referências: [comunicado Next.js](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [avisos DOMPurify](https://github.com/cure53/DOMPurify/security/advisories).

## Ferramentas de desenvolvimento e testes

Vitest e cobertura 4.1.12, Vite 8.3.5, plugin React 6.1.2 e Happy DOM 21.0.4. Configurações ESM explícitas (.mts), até quatro workers e testes com confirmação de diálogos controlada pelo teste. Regenerar o cliente Prisma após instalar as dependências continua sendo necessário e já consta no postinstall.

Os alertas críticos, altos e moderados dessas ferramentas foram eliminados. A auditoria completa permanece com **um alerta alto de braces 3.0.3**, dependência de fast-glob/micromatch utilizada pelo plugin ESLint do Next. O registro consultado informa não haver versão corrigida publicada: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

Esse pacote não aparece na árvore de produção. O problema envolve padrões de chaves profundamente aninhados na ferramenta de análise de arquivos. Não é apresentado como corrigido nem ocultado com exceção de auditoria; não houve redução das regras de lint ou de segurança. Evitar aceitar padrões arbitrários de fontes externas para executar a ferramenta. Atualizar a cadeia assim que uma correção oficial for publicada; não manter uma implementação própria do parser para contornar o aviso.

## Repetir a verificação

- `pnpm install --frozen-lockfile`
- `pnpm audit --prod`
- `pnpm audit` (inclui o alerta de desenvolvimento descrito acima)
- `pnpm typecheck`, `pnpm lint`, `pnpm test:run` e `pnpm build`.
- Integração: `pnpm test:integration`, somente com o PostgreSQL isolado erp_test. Nunca usar o banco operacional para a suíte.
