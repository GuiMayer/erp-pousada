<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Versionamento

Ao concluir cada mudança, valide o trabalho e faça commit. Prefira commits separados por tarefa, com mensagens que descrevam o resultado; mantenha juntos os arquivos e testes necessários para cada mudança funcionar.

## Estágio do produto

O aplicativo ainda não entrou em produção; os dados atuais são exemplos de desenvolvimento. Não introduza requisitos de retrocompatibilidade, conversão de dados históricos ou avisos de dados legados por hipótese. Exemplos podem ser atualizados para a modelagem atual. Preserve validações de integridade, autorização e consistência financeira: dados incompletos devem gerar mensagens objetivas sobre o que falta. Migrações de esquema e versionamento continuam necessários e não significam compatibilidade com uma instalação em produção. Não reescreva migrações já aplicadas apenas para remover referências internas.
