# Auditoria e logs

O histórico de auditoria registra operações de negócio no PostgreSQL, na mesma transação da alteração. Uma falha reverte ambos. A conta da aplicação pode consultar e inserir registros, mas não alterá-los nem apagá-los. O histórico integra o backup do banco.

## Consulta

A aba de auditoria exige `auditLog.read`. Em produção, consulta 50 registros por página, com busca, usuário, tipo, operação e período filtrados no servidor. As datas aparecem no horário de Brasília (`America/Sao_Paulo`); o banco e a API preservam o instante completo. Os filtros de período incluem todo o último dia selecionado, no horário de Brasília. No celular, os registros aparecem como cartões com detalhes expansíveis.

Novos registros identificam o executor por ID estável e nome vigente na operação. Aprovações mostram o ID do responsável, executor e permissão concedida. Registros antigos mantêm as informações originalmente disponíveis; IDs ausentes não são inferidos. Mudanças de cadastros incluem estados anterior e posterior sanitizados; credenciais são ocultadas e CPF é mascarado. Edições de comandas e mudanças de estado das mesas também são auditadas.

## Diagnóstico técnico

As APIs geram JSON em stdout/stderr com horário UTC, evento, identificação de requisição, rota, método, situação e duração. Quando disponível, incluem o ID do usuário e a operação. O cabeçalho `X-Request-Id` permite correlacionar uma resposta com seus registros. Falhas incluem classe, código controlado e quadros da pilha, sem a mensagem original do erro. Senhas, cookies, tokens, cabeçalhos, consultas da URL e conteúdo de formulários não são registrados pelo logger.

Eventos `authentication.failed` identificam a conta tentada por hash, sem senha ou login em texto. `security.denied` cobre rejeições de origem, permissão, aprovação, autenticação de login/supervisor e excesso de tentativas nas APIs. Sessões ausentes ou expiradas em consultas normais produzem apenas o registro da requisição, evitando classificá-las como ataque. Login e logout bem-sucedidos continuam disponíveis no histórico de sessões.

O worker de notificações usa o mesmo logger para falhas; a verificação de saúde registra falhas de acesso ao banco. O proxy Caddy registra acessos em JSON, excluindo cabeçalhos e URI para não registrar credenciais ou parâmetros. Os registros de aplicação permitem consultar a rota e a identificação da requisição.

```powershell
docker compose --env-file .env.docker.local -f docker-compose.yml -f compose.lan.yml logs --since 30m --tail 200 app notification-worker
docker compose --env-file .env.docker.local -f docker-compose.yml -f compose.lan.yml logs --since 30m --tail 200 proxy postgres backup-worker
```

Antes de compartilhar logs, revise o conteúdo: registros de terceiros (PostgreSQL, Docker, Caddy, ferramentas de backup) seguem seus próprios formatos. O arquivo de ambiente contém credenciais e não deve acompanhar diagnósticos.

## Retenção e operação

Todos os serviços Docker configurados usam `json-file`, com rotação de cinco arquivos de até 10 MB por contêiner (aproximadamente 50 MB). A configuração passa a valer quando os contêineres são recriados. Volumes do banco e backups permanecem. A rotação descarta os registros técnicos mais antigos; recriar um contêiner também remove seu histórico técnico anterior. Exporte os logs necessários antes de manutenção, se precisar preservá-los.

A auditoria de negócio não tem exclusão automática. Sua política atual é retenção integral no banco, incluída nos backups. Arquivamento ou descarte depende de uma política definida pela pousada e de uma rotina administrativa externa à conta da aplicação. Logs técnicos não substituem a auditoria nem o backup. Não se habilita registro irrestrito de SQL, que pode expor dados e aumentar uso de disco.
