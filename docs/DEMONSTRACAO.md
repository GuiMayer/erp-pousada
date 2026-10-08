# Demonstração temporária com PostgreSQL

Este ambiente permite ao cliente experimentar a aplicação real com dados fictícios. O projeto Docker `erp-pousada-demo` tem banco, rede, contas, sessões, notificações e imagem próprios. O cookie de sessão também é separado (`erp_demo_session`), para que entrar na demonstração não substitua o login operacional no mesmo navegador. A instalação principal `erp-pousada`, em `localhost:3000`, continua funcionando. A demonstração usa `localhost:3001`.

## Iniciar

Na pasta do projeto, com o Docker Desktop funcionando:

```powershell
.\scripts\start-demo.ps1
```

No primeiro início, a imagem é construída e as contas exclusivas são geradas. Abra `http://localhost:3001`. As credenciais estão em `.local/demonstracao-acesso.txt`, protegido para o usuário do Windows e ignorado pelo Git. A conta `demo` permite explorar todos os módulos; `recepcao`, `restaurante` e `estoque` demonstram acessos por setor. As contas usam a senha de demonstração indicada nesse arquivo, sem relação com credenciais da instalação principal.

Há quartos disponíveis, ocupados, em limpeza e manutenção; reservas e hóspedes fictícios; vendas e receitas financeiras; mesas e uma comanda aberta; produtos, estoque e alertas; receita de produção; despesas e contas a receber. Datas são ajustadas ao dia de início. As operações usam as regras e permissões normais do sistema. O aviso de demonstração aparece no topo da página.

Para repetir a apresentação usando a imagem já construída, sem recompilar:

```powershell
.\scripts\start-demo.ps1 -NoBuild
```

Cada execução do script encerra a sessão anterior de demonstração e recria os exemplos. Após mudanças no código, execute sem `-NoBuild`.

## Encerrar e descartar alterações

```powershell
.\scripts\stop-demo.ps1
```

O comando encerra exclusivamente `erp-pousada-demo` e remove os recursos temporários. Não encerra nem remove os serviços, dados ou backups de `erp-pousada`. Fechar a aba ou o terminal não encerra os contêineres; use o comando acima.

O PostgreSQL demonstrativo armazena seus arquivos em `tmpfs`, sem volume persistente de dados. Se esse contêiner parar, o banco deixa de existir. Todos os serviços usam `restart: no`, portanto não retomam automaticamente uma sessão antiga quando o Docker ou computador reinicia. Para voltar a apresentar, execute `start-demo.ps1`; não reinicie somente o PostgreSQL, porque é necessário recriar migrações e exemplos.

O estado original corresponde aos exemplos recriados, com datas atuais e novas sessões/identificadores. Não há promessa de bytes ou horários idênticos entre apresentações. Senhas de demonstração e endereço permanecem nos arquivos locais para facilitar apresentações futuras. Não há backup automático desse banco.

## Acesso privado opcional por Tailscale

O Tailscale é uma opção externa da instalação, sem dependência ou configuração automática pelo aplicativo. Para uma apresentação remota, encaminhe o Tailscale Serve para `http://127.0.0.1:3001` e use o endereço HTTPS privado fornecido pelo Tailscale. Configure a mesma origem no início:

```powershell
.\scripts\start-demo.ps1 -NoBuild -AppUrl 'https://seu-computador.sua-rede.ts.net'
```

A configuração fica somente em `.env.demo.local`; não altera o `APP_URL` operacional. Use o endereço HTTPS também para fazer login, pois a aplicação autoriza uma única origem por instalação. Para voltar ao endereço local, execute com `-AppUrl 'http://localhost:3001'`.

O cliente deve ter acesso autorizado pelo Tailscale apenas ao site demonstrativo. Não use o encaminhamento para `localhost:3000`. Ao encerrar, a porta 3001 deixa de responder. A demonstração não cria nem remove configurações Serve, convites ou permissões do Tailscale.

## Isolamento e limites

Não são copiadas informações do banco principal. O PostgreSQL não publica sua porta; o aplicativo publica somente `127.0.0.1:3001`. O banco e os serviços auxiliares ficam em uma rede Docker interna. Somente o servidor web participa também de uma rede própria de acesso para publicar a porta local. As redes demonstrativas não compartilham volumes de dados ou serviços com a instalação operacional. A conta do aplicativo mantém restrições de produção, inclusive a proibição de alterar ou apagar auditoria. O seed e o cliente demonstrativo recusam conexão que não seja `postgres-demo/pousada_demo` com o modo explicitamente habilitado.

O banco temporário tem limite de 256 MB de arquivos; apresentações muito longas com grande volume de dados podem esgotar esse espaço. Os dados ativos são temporários, mas Docker, sistema operacional e arquivo de troca podem manter resíduos técnicos: este modo não é uma ferramenta de apagamento seguro. Utilize exclusivamente dados fictícios.

## Testar alterações simultâneas

A demonstração inclui as proteções de [concorrência e sincronização](CONCORRENCIA.md). Abra o mesmo cadastro em dois dispositivos, altere e salve no primeiro; tente salvar o segundo. A aplicação deve preservar o rascunho e pedir revisão dos dados atuais. Use contas distintas para validar as permissões de cada setor.
