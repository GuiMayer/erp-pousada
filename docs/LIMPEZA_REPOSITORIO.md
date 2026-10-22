# Limpeza do repositório — 22/10/2026

Execução do [mapa de arquivos sem uso](MAPA_LEGADOS_E_ARQUIVOS_SEM_USO.md). O mapa original registra o estado anterior à limpeza.

## Configuração local

Foram removidas do `.env.local` as variáveis sem consumidores `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` e `NEXT_PUBLIC_SUPERVISOR_PASSWORD`, além dos comentários locais específicos do Supabase. Os valores não foram copiados para este documento, backups ou commits.

O arquivo continua ignorado pelo Git. Este commit registra a limpeza sem versionar o ambiente local. As configurações de PostgreSQL, demonstração, Docker e autenticação atuais foram preservadas. Excluir uma variável local não revoga a credencial no serviço externo; não foram realizadas operações na conta Supabase.
