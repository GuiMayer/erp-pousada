# Configuração da instalação

A configuração efetiva do Docker vem de `.env`, seguindo [o guia de produção](../docs/PRODUCAO.md). `APP_URL`, `DOMAIN` e `POSTGRES_PASSWORD` são obrigatórios para a instalação com HTTPS. Não versione esse arquivo.

O menu Windows grava pasta e intervalo de backup em `.env.backups`, sem substituir `.env`. O arquivo `app.config.json` serve como registro local desses ajustes; não é a fonte de segredos para o Compose. O exemplo contém senha vazia propositalmente.

`Caddyfile` configura HTTPS e encaminha tráfego para o serviço da aplicação. O modo `database` é definido no build; `demo-localStorage` deve ser usado apenas para demonstração isolada.
