# Instalação local no Windows

Para demonstração, siga o README; para desenvolvimento com banco, use `.env.example`, `compose.dev.yml` e os comandos `pnpm db:up`, `pnpm exec prisma migrate deploy` e `pnpm db:seed`.

Para operação com dados reais, siga integralmente [Produção](PRODUCAO.md). O acesso pela rede deve usar o domínio HTTPS configurado; a aplicação não publica mais HTTP em todas as interfaces nem o banco na porta do host.

O menu `pousada-menu.bat` exige Docker Desktop ativo e `.env` de produção configurado. Ele utiliza o Compose com HTTPS e guarda ajustes de backup em `.env.backups`, preservando os segredos de `.env`. Cadastre o primeiro supervisor conforme o guia antes de entrar.

As opções de limpeza e restauração são destrutivas e exigem confirmação no menu. Faça uma cópia externa do backup antes de executá-las. Para recuperação, pare a aplicação, valide o dump em banco separado e confira a compatibilidade da imagem com as migrations.

Antes de publicar, valide DNS, HTTPS, alertas externos e restauração de backups. A execução pelo menu não substitui a homologação dos fluxos.
