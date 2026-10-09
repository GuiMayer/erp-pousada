# Docker Engine no Debian WSL

## Instalação local migrada em 8 de outubro de 2026

O ERP deste computador usa Debian 13 no WSL 2 com Docker Engine e Compose do repositório oficial Docker. Não há ambiente gráfico Linux. O Docker Desktop permanece instalado e com seus dados preservados para recuperação, mas fica desligado e não é o motor utilizado pelo painel.

A migração preservou as imagens instaladas e restaurou o banco normal a partir de backup final validado, em um novo volume do Debian. Migrações e permissões foram aplicadas depois da restauração. A demonstração foi recriada com exemplos próprios, sem copiar dados operacionais. O banco antigo não foi removido.

A configuração deste computador está em `.local/docker-runtime.json`, ignorada pelo Git:

```json
{"Backend":"wsl","Distribution":"Debian"}
```

Sem esse arquivo, os scripts mantêm compatibilidade com Docker Desktop. Não copiar o arquivo para outra máquina sem preparar e validar o Debian nela.

## Uso

O atalho **ERP Pousada - Servidores** da área de trabalho controla normal, demonstração, links Tailscale e backups. O link **Iniciar Docker Debian** ativa o motor Linux. Não abrir Docker Desktop em paralelo.

No PowerShell, dentro do repositório, usar o adaptador para comandos manuais:

```powershell
.\scripts\docker.ps1 ps
.\scripts\docker.ps1 stats --no-stream
.\scripts\docker.ps1 compose --env-file .env.docker.local -f docker-compose.yml -f compose.lan.yml ps
.\scripts\start-demo.ps1 -NoBuild
.\scripts\stop-demo.ps1
.\scripts\check-installation.ps1
```

O comando Windows `docker` instalado pelo Desktop continua associado à instalação antiga. Para controlar a instalação nova, usar o adaptador acima ou Docker dentro do Debian. Não executar comandos de limpeza usando o contexto antigo por engano.

O adaptador centraliza a seleção do motor e usa `/usr/local/bin/erp-pousada-docker`, instalado a partir de `scripts/docker-wsl-launcher.sh`. Argumentos são transportados em uma sequência delimitada por NUL codificada em base64, preservando espaços e aspas sem avaliar código. Base64 não é criptografia: não enviar senhas como argumentos; manter os arquivos privados e variáveis de ambiente existentes.

Para preparar outra máquina: instalar Debian WSL 2, habilitar systemd em `/etc/wsl.conf` e instalar Docker Engine/Compose conforme a referência oficial abaixo. Antes de selecionar o novo motor, instalar o lançador dentro do Debian (adaptando o caminho absoluto do repositório):

```powershell
wsl -d Debian -u root -- install -m 755 /mnt/c/caminho/do/repo/scripts/docker-wsl-launcher.sh /usr/local/bin/erp-pousada-docker
```

Só então criar a configuração privada do motor, verificar `scripts/docker.ps1 info`, preparar imagens, restaurar e validar o banco em volume novo. Este passo instala somente o lançador; não instala o Docker nem migra os dados automaticamente.

Os caminhos de arquivos e de pastas de backup do Windows são convertidos para `/mnt/c/...` apenas quando representam arquivos/montagens do host. O conteúdo dos comandos executados dentro dos contêineres permanece literal. A configuração privada continua no Windows, sem criar outra cópia de credenciais no Linux.

## Memória e disponibilidade

O perfil inicial em `C:\Users\usuario\.wslconfig` limita a máquina WSL a 4 GB, quatro processadores e 2 GB de swap, com `autoMemoryReclaim=dropCache`. Esses limites são compartilhados por todas as distribuições WSL 2 do usuário. Não representam memória reservada integralmente.

O adaptador mantém um cliente WSL leve, oculto, executando `sleep infinity`: serviços systemd sozinhos não garantem a vida da distribuição WSL. O cliente tem identificador salvo em `.local/docker-wsl-keepalive.json`, usa exclusão mútua para evitar duplicação e não depende da janela do painel ficar aberta.

O Docker é habilitado no systemd para iniciar quando o Debian inicia. A migração não cria inicialização automática no boot do Windows. Depois de reiniciar o computador, iniciar pelo painel; configurar e testar a automação de boot separadamente antes de depender dela em produção.

Para liberar completamente a memória: encerrar normal e demo pelo painel, fechar o painel e executar `wsl --shutdown`. Isso encerra todas as distribuições e o cliente de permanência; não usar enquanto houver trabalho em andamento. A próxima chamada ao adaptador inicia o ambiente novamente.

Construções de imagens têm picos maiores do que a execução do ERP. Preferir imagens já preparadas e não executar construções paralelas. Os limites individuais dos serviços e ajustes de pool/banco propostos em `PLANO_OTIMIZACAO_MEMORIA.md` permanecem etapas separadas, a validar.

## Acesso e backups

Os endereços e a autorização de origem Tailscale são preservados. As pastas de backup continuam acessíveis no Windows, incluindo a segunda cópia escolhida pelo painel. O envio ao Drive depende do cliente de sincronização do Windows.

Os volumes Caddy novos criam uma autoridade HTTPS local nova. Para acesso LAN diretamente pelo Caddy, instalar/confiar novamente no certificado conforme o guia; o acesso HTTPS pelo Tailscale usa seus próprios certificados e não depende dessa autoridade local. Os volumes Caddy antigos permanecem na instalação Desktop para recuperação.

Antes de voltar à instalação antiga, parar a nova e preservar quaisquer lançamentos feitos depois da migração: os bancos passaram a ser independentes. Remover/renomear `.local/docker-runtime.json` seleciona Desktop, mas isso não sincroniza dados nem os transfere de volta. Não remover volumes ou a distribuição antiga até validar restauração, reinício do computador e uso real.

## Verificações realizadas na migração

- Docker Engine respondendo no Debian, com aproximadamente 4 GB de RAM disponíveis ao WSL.
- Normal e demo saudáveis simultaneamente; ambos os endereços HTTPS Tailscale responderam.
- Login da demo com `teste` / `teste` retornou sucesso.
- Restauração do backup operacional concluída em transação; permissões e migrações reaplicadas com sucesso.
- Backup pelo painel concluído, incluindo segunda cópia na pasta Windows; verificação de instalação confirmou banco, aplicativo, notificações e backup.
- Testes Windows de prazo, cancelamento, preservação de argumentos e caminhos passaram, incluindo execução real no Debian. A inicialização da demo em segundo plano foi validada pelo trabalhador do painel.
- Construção e atualização de estado do painel verificadas pelo modo de autoteste.
- Na medição final, o WSL ocupava aproximadamente 1,9 GB residentes no Windows com os dois ambientes ativos. É uma medição pontual, não limite de consumo sob carga.
- Reinício completo do computador, teste de carga prolongado e confiança no novo certificado Caddy para LAN ainda requerem validação própria. O acesso Tailscale foi verificado nesta migração.

## Referências

- [Docker Engine no Debian](https://docs.docker.com/engine/install/debian/)
- [Serviços systemd no WSL e permanência da distribuição](https://learn.microsoft.com/en-us/windows/wsl/systemd/)
- [Memória e configuração global do WSL](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
