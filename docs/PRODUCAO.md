# Instalação e operação em produção

O modo operacional é `database`. As credenciais `operador/1234` e `supervisor/adm123` funcionam exclusivamente na demonstração. Nunca exponha uma instalação demonstrativa como sistema operacional.

## Desenvolvimento

Copie `.env.example` para `.env`. Ajuste `.env.local` para `NEXT_PUBLIC_DATA_ADAPTER=database`, pois esse arquivo tem precedência na configuração do Next.js. Execute:

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

Antes do seed, defina `BOOTSTRAP_ADMIN_USERNAME` e `BOOTSTRAP_ADMIN_PASSWORD` no ambiente. Use senha única, com ao menos 12 caracteres e no máximo 72 bytes UTF-8. Remova a senha de bootstrap do ambiente após a criação do administrador. O seed preserva usuários existentes e não adiciona quartos, vendas ou exemplos.

## Produção com Docker e HTTPS

Use servidor Linux com Docker Compose, domínio apontando para o servidor e portas 80/443 acessíveis. Crie `.env` localmente, fora do controle de versão:

```dotenv
POSTGRES_PASSWORD=<segredo-aleatório-próprio-sem-caracteres-reservados-de-URL>
DOMAIN=erp.sua-pousada.com.br
APP_URL=https://erp.sua-pousada.com.br
BACKUP_HOST_DIR=./backups
BACKUP_INTERVAL_MINUTES=30
BACKUP_RETENTION_DAYS=14
```

O adaptador `database` é fixado no build do Docker. Arquivos `.env` são excluídos do contexto de build. A API exige que a origem das gravações coincida com `APP_URL`. Não configure domínio alternativo sem atualizar essa variável.

```sh
docker compose -f docker-compose.yml -f compose.https.yml up -d --build
```

O proxy Caddy solicita e renova certificados HTTPS. O banco não publica portas no host. A porta da aplicação fica restrita ao localhost. O serviço aplica migrations antes de iniciar. Para criar o primeiro supervisor, defina as variáveis de bootstrap apenas no comando de seed; não grave credenciais no histórico ou em arquivos versionados. O container aceita `pnpm db:seed` via `docker compose exec -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD app pnpm db:seed`, recebendo os valores do ambiente local.

Depois de entrar, cadastre quartos, categorias e produtos em Administração. Defina dados do estabelecimento, limites e contas de acesso individuais. Não use o seed da demonstração para preparar o banco real.

## Instalações anteriores

Faça backup antes da atualização. As novas migrations adicionam sessões, controle de tentativas e recibos de operação, sem remover tabelas de negócio. Senhas antigas em texto puro deixam de autenticar; use `pnpm db:reset-admin`, com `BOOTSTRAP_ADMIN_USERNAME` e `BOOTSTRAP_ADMIN_PASSWORD` definidos, para corrigir o acesso do supervisor escolhido. O comando exige que o supervisor já exista, atualiza o hash e revoga suas sessões. Não altera dados de negócio nem cria contas silenciosamente.

A importação JSON é um snapshot completo dos dados operacionais: substitui o conjunto inteiro dentro de uma transação. Usuários, sessões, auditoria e configurações são preservados e não aparecem nesse export. Para recuperação completa, use o backup PostgreSQL.

## Backups e recuperação

O worker grava dumps a cada 30 minutos, valida o índice, publica o arquivo somente após sucesso e remove dumps com mais de 14 dias. Diretórios e credenciais precisam de acesso restrito. A cópia no mesmo servidor não protege contra perda do servidor: configure cópia criptografada para um destino externo e monitore sua execução antes da liberação.

```sh
docker compose exec backup-worker sh /scripts/db-backup.sh
docker compose exec backup-worker sh /scripts/db-restore.sh /backups/arquivo.dump
```

A restauração substitui dados do banco selecionado e deve ser executada com a aplicação parada. Primeiro restaure em ambiente separado; confira usuários, quartos, estoque e financeiro. `pg_restore` usa uma transação e interrompe em erro. Guarde um dump anterior à atualização e o identificador da imagem anterior. Para reversão, pare a aplicação, restaure esse dump e reative a imagem compatível; não rode código antigo contra um schema atualizado sem verificar compatibilidade.

## Monitoramento e homologação

`/api/health` retorna 200 quando o banco responde e 503 quando falha, sem expor credenciais. O Compose verifica saúde da aplicação, banco e worker. Configure monitor externo para a URL HTTPS, validade do certificado, espaço em disco e idade dos backups, com alertas para os responsáveis. Containers com estado `unhealthy` não geram, por si só, uma notificação externa.

Antes do piloto, valide login de ambos os perfis, reserva e check-in, quitação e check-out, venda/estorno, duas vendas simultâneas, comanda, estoque, receita/produção, despesas e restauração. Use dados fictícios na homologação e confirme resultados com a equipe da pousada.

## Verificações automatizadas

```sh
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
pnpm audit --prod
```

A integração exige um banco descartável chamado **erp_test** em `DATABASE_URL`. O teste recusa qualquer outro nome e limpa tabelas nesse banco. Execute migrations e `pnpm test:integration`. O GitHub Actions cria um PostgreSQL separado, executa esses checks e valida backup/restauração. Nunca aponte os testes para produção.
