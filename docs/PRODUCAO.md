# Instalação e operação em produção

O modo operacional é `database`, com PostgreSQL relacional, autenticação no servidor e contas individuais. As credenciais da demonstração são exclusivas de `demo-localStorage`.

Para instalar no computador da pousada com Docker Desktop, siga [Instalação da pousada](INSTALACAO_POUSADA.md). Esse guia cobre instalação vazia, contas do banco separadas, HTTPS interno, acesso na rede, backup externo e restauração. O menu `pousada-menu.bat` usa a mesma configuração.

## Desenvolvimento

Use `.env.local` com `DATABASE_URL`, `NEXT_PUBLIC_DATA_ADAPTER=database` e `APP_URL=http://localhost:3000`. Execute `pnpm db:up`, `pnpm exec prisma migrate deploy` e `pnpm db:seed`. Os comandos leem os arquivos de ambiente na mesma precedência do Next.js. Defina as credenciais fortes de bootstrap somente no ambiente do seed e remova-as após o uso.

## Implantação e atualização

O Compose aplica migrations com `pousada_migrator`, concede os acessos de execução e só então inicia o app. A aplicação utiliza `pousada_app`; o worker usa `pousada_backup`. A conta administrativa não deve ser usada pelo app. Confira [permissões](PERMISSOES.md) para a migração dos perfis anteriores.

Instalações que usavam a conta única precisam de backup e conversão de ownership/roles por um administrador antes de usar o novo Compose. A inicialização de roles do PostgreSQL acontece somente em volumes novos; não apague um volume antigo para repetir essa etapa.

Guarde um dump anterior à atualização e a imagem compatível. Restauração exige aplicação parada e validação prévia em outro banco. JSON operacional não inclui usuários, sessões, configurações e auditoria; use dump PostgreSQL completo para recuperação.

## Verificações

`pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:integration`, `pnpm build` e `pnpm audit --prod` devem passar. A integração aceita exclusivamente o banco descartável `erp_test`, que é limpo pelos testes. Prepare suas contas restritas com os scripts `db-roles.sql` e `db-runtime-grants.sql`, como no CI; nunca aponte os testes para produção.

O GitHub valida migrations, contas restritas, backup/restauração, imagem e inicialização da instalação Docker completa. Configure cópia externa criptografada, monitoramento e confiança do certificado antes de liberar o uso real.
