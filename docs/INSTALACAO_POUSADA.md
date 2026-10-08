# Instalação no computador da pousada

Esta versão opera com PostgreSQL 16 e Docker Desktop. O banco começa vazio, conforme a decisão de não migrar os dados de demonstração. O localStorage continua disponível apenas no modo demo; não funciona como armazenamento operacional.

## Preparar o Windows

1. Ative Docker Desktop com containers Linux. Ele deve iniciar sem erros e `docker info` deve responder. Configure início do Docker ao entrar no Windows; os serviços usam `restart: unless-stopped`.
2. Abra PowerShell na pasta do projeto e execute `powershell -NoProfile -File scripts/setup-docker.ps1`. O comando gera quatro senhas distintas em `.env.docker.local`, ignorado pelo Git e restrito ao usuário atual. Não sobrescreve configurações existentes.
3. Execute `powershell -NoProfile -File scripts/start-docker.ps1`. O Compose aplica migrations com conta própria, ajusta permissões e inicia app, banco, proxy e backups. O administrador inicial é criado sem quartos, vendas ou outros exemplos.
4. A credencial inicial fica em `.local/administrador-inicial.txt`, também restrito e ignorado. Entre com `admin`, guarde a senha em local seguro e remova o arquivo após o uso. A senha não é enviada a logs nem impressa pelo instalador; não há segredo fixo no código.

Para desenvolvimento com dados separados, use `compose.dev.yml` e `.env.local` com `NEXT_PUBLIC_DATA_ADAPTER=database`. Os scripts Prisma agora leem os arquivos de ambiente na mesma ordem do Next.js. Variáveis explicitamente definidas no processo mantêm prioridade. O build Docker sempre seleciona `database`, independentemente da demonstração local.

## HTTPS no computador e na rede

Por padrão, o endereço é `https://localhost` e o proxy escuta somente no computador da instalação. O Caddy usa uma autoridade certificadora interna; instale a raiz desta instalação como confiável antes de usar o sistema. Exporte somente o certificado público:

```powershell
docker compose --env-file .env.docker.local -f docker-compose.yml -f compose.lan.yml cp proxy:/data/caddy/pki/authorities/local/root.crt .local/pousada-root.crt
```

Confira a origem do certificado e importe-o no armazenamento de autoridades confiáveis do Windows e dos dispositivos autorizados. A instalação de confiança é uma ação administrativa da equipe responsável. Nunca distribua a chave privada da autoridade e não ignore avisos de certificado no navegador.

Para outros computadores, defina um nome resolvido pelo DNS da rede ou pelo arquivo hosts, configure `DOMAIN` e `APP_URL=https://<nome>` em `.env.docker.local`, e ajuste `LAN_BIND_ADDRESS` para o IP fixo da máquina. Restrinja a porta 443 no firewall à rede da pousada. Não exponha o banco: ele não publica porta no host. O endereço e a confiança do certificado precisam estar corretos em todos os dispositivos.

Use `start-docker.ps1` novamente após mudar o endereço. Sessões usam cookie seguro; não troque a URL por HTTP para contornar problemas com certificados. Domínio público continua sendo suportado por `compose.https.yml` em vez do perfil LAN.

## Alternativa opcional: acesso pelo Tailscale

O responsável pela instalação pode usar Tailscale para facilitar o acesso remoto. É uma escolha de infraestrutura externa, sem integração oficial ou dependência do ERP. A instalação padrão continua sendo a descrita acima; esta alternativa pode substituí-la para o acesso da equipe.

Depois de preparar o Docker e criar o administrador pelos passos anteriores:

1. Instale Tailscale no Windows da pousada e nos dispositivos da equipe, conectando-os à mesma rede Tailscale (tailnet). Habilite MagicDNS e certificados HTTPS conforme as instruções do serviço.
2. No computador da pousada, configure o encaminhamento para a porta local do app:

   ```powershell
   tailscale serve --bg --https=443 http://127.0.0.1:3000
   tailscale serve status
   ```

   Copie o endereço HTTPS informado, por exemplo `https://pousada.nome-da-rede.ts.net`. O Serve oferece acesso dentro da tailnet, sujeito às regras de acesso configuradas. Use Serve para este cenário; Funnel publica o serviço na internet. [Documentação do Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).

3. Em `.env.docker.local`, substitua somente `APP_URL` pelo endereço HTTPS exato informado. Mantenha as senhas e as demais opções. Recrie o app para aplicar a mudança:

   ```powershell
   docker compose --env-file .env.docker.local -f docker-compose.yml up -d app
   ```

   O Docker mantém o backend em `127.0.0.1:3000` e o banco sem porta publicada. Neste caminho, o Tailscale entrega o HTTPS ao navegador; não é necessário importar a raiz do Caddy para acessar o endereço `.ts.net`.

4. Abra esse mesmo endereço HTTPS em todos os dispositivos, inclusive no servidor, e confira login e uma operação de cadastro. O app valida a origem contra `APP_URL`; usar `https://localhost`, um IP ou outro nome após essa alteração pode resultar em “Origem não autorizada”. O login e as permissões do ERP continuam obrigatórios.

O proxy Caddy pode permanecer disponível localmente, mas não participa desse encaminhamento. O menu e `start-docker.ps1` continuam iniciando a configuração padrão; preserve o `APP_URL` escolhido nas atualizações. Restrinja o acesso na tailnet à equipe e confira novamente o acesso após reiniciar o Windows, o Docker e o Tailscale. `--bg` mantém o Serve em segundo plano; consulte a [referência de comandos](https://tailscale.com/docs/reference/tailscale-cli/serve) para gerenciar esse serviço.

Esta opção não configura backup externo nem monitoramento. A contratação, as condições do plano e a administração do Tailscale ficam a cargo do responsável pela instalação.

## Contas do banco e atualizações

- `pousada_admin`: administração da instalação, sem uso pela aplicação.
- `pousada_migrator`: criação/alteração de schema e manutenção; não é superusuário.
- `pousada_app`: operações nos dados, sem criar tabelas, administrar usuários do PostgreSQL ou alterar a tabela de migrations; auditoria permite inserção/consulta, sem edição/exclusão.
- `pousada_backup`: somente leitura para exportação; não pode alterar dados.

Migrations rodam em serviço separado, antes do app. Antes de atualizar, produza um backup, confira a imagem/commit de origem e execute novamente o instalador. Preserve o volume `erp-pousada_pousada_postgres_data`. Não use `down -v`, `migrate reset` ou limpeza de volumes em uma instalação real.

Volumes criados pela configuração antiga não são convertidos automaticamente: faça backup e ajuste ownership, contas e concessões com o administrador antes de usar esta configuração. Não apague um volume existente para resolver falhas de acesso.

## Backup e recuperação

O worker faz dumps a cada 30 minutos, com retenção de 14 dias e arquivos publicados só depois de verificar seu índice. As permissões locais são restritas. Falhas deixam `last-error`, tornam o worker não saudável e são tentadas novamente no próximo intervalo.

Configure uma cópia fora do computador antes de operar com dados reais. Crie um remote `crypt` do rclone para o destino escolhido, guarde `rclone.conf` em `.local/backup-config` com acesso restrito e defina `BACKUP_REMOTE=<remote-crypt>:pousada`. Somente destinos `crypt` são aceitos pela cópia automática. O segredo de criptografia deve ter uma cópia de recuperação separada. Não há contratação, envio ou conexão externa enquanto essas opções estiverem vazias.

Quando configurada, a cópia externa precisa concluir para atualizar `last-success`; `last-local-success` e `last-remote-success` distinguem cada etapa. Configure `ALERT_WEBHOOK_URL` somente para um destino autorizado pela pousada. O alerta envia apenas uma mensagem genérica de falha. Para indisponibilidade total do computador, use um monitor fora dessa máquina; um container parado não consegue enviar seu próprio alerta.

Verifique com `powershell -NoProfile -File scripts/check-installation.ps1` após confiar no certificado. Teste recuperação em banco separado antes da liberação. Os dumps incluem usuários, permissões, configurações e históricos; JSON operacional não substitui esse backup.

Restauração operacional (substitui os dados): pare app e backup-worker, guarde um dump do estado atual, e execute `docker compose --env-file .env.docker.local run --rm restore /backups/arquivo.dump`. Reexecute `database-permissions` antes de reiniciar a aplicação. Use imagem compatível com as migrations do dump. A equipe deve confirmar a restauração e reconciliar operações posteriores ao backup antes de liberar usuários.

## Liberação

Cadastre quartos, produtos, contas e usuários com seus perfis. Confira login com contas distintas, reserva/check-in/checkout, saldo quitado, caixa, comanda, estoque e duas operações simultâneas. Reinicie os serviços e confirme persistência. Verifique backup local, cópia externa e restauração, e confirme acesso com certificado válido nos computadores da equipe.

Somente após essas verificações a instalação está pronta para uso real. A Vercel não participa da implantação.

Referências: [Caddy TLS interno](https://caddyserver.com/docs/caddyfile/directives/tls), [rclone crypt](https://rclone.org/crypt/) e [perfis do PostgreSQL](https://www.postgresql.org/docs/16/role-membership.html).

## Central de notificações

O serviço `notification-worker` avalia lembretes mesmo sem usuários conectados. Para configurações, retenção, permissões e limites de avisos do navegador, consulte [Notificações operacionais](NOTIFICACOES.md). A atualização por `scripts/start-docker.ps1` acrescenta a credencial restrita do worker em instalações existentes sem substituir senhas.
