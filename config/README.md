# Configuracao local

Copie `app.config.example.json` para `app.config.json` antes de instalar no PC do cliente.

`app.config.json` nao deve ser versionado. Ele guarda configuracoes locais da instalacao, como pasta de backup, intervalo de backup e modo de dados.

Campos principais:

- `dataMode`: use `database` para operacao real. Use `demo-localStorage` apenas para demonstracao isolada.
- `backupDirectory`: pasta do Windows onde os backups `.dump` serao salvos.
- `backupIntervalMinutes`: intervalo do backup automatico. Use `0` para desativar.
- `host`: mantenha `0.0.0.0` para permitir acesso na rede local.
- `port`: porta HTTP exposta pelo sistema.
- `database`: configuracao usada pelos containers Docker.

Em banco novo, os dados operacionais devem iniciar vazios. Dados demonstrativos devem ser carregados por acao separada.
