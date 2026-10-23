<div align="center">

# ERP Pousada

**Hospedagem, venda de bebidas e gestão financeira em um só painel.**

Aplicação web em português para organizar a rotina de pousadas: da reserva ao fechamento de caixa, com controle de consumo, estoque e relatórios.

[Acesse a demonstração](https://guimayer.github.io/erp-pousada/) · [Conheça as telas](#telas-do-sistema) · [Execute localmente](#demonstração-local) · [Configure o banco](#desenvolvimento-com-postgresql) · [Documentação](#documentação)

**Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 · PostgreSQL 16**

</div>

## Experimente a demonstração

**[Abrir o ERP Pousada no navegador](https://guimayer.github.io/erp-pousada/)** — sem instalação ou cadastro.

Na tela de login, o pop-up **Acessos da demonstração** mostra as credenciais e permite preencher o acesso. Para explorar todos os módulos, use **Supervisor**: usuário `supervisor`, senha `adm123`.

Os dados são fictícios e as alterações ficam apenas no seu navegador. Para recomeçar, saia da conta e use **Restaurar exemplos e descartar alterações** no pop-up de acesso.

## Visão geral

O ERP Pousada reúne a recepção, a frente de caixa e o financeiro em uma interface compartilhada. Os módulos trabalham com quartos, hóspedes, produtos e lançamentos para acompanhar a operação do estabelecimento.

O projeto está em desenvolvimento. Há um modo de demonstração sem banco e uma camada de persistência com PostgreSQL; consulte o [estado atual](#estado-atual) antes de planejar uma instalação operacional.

A aba **Cadastros** reúne pessoas e empresas, fornecedores, bebidas, capacidades dos quartos e tarifas por pessoa/noite conforme a quantidade de hóspedes. Pessoas podem ser vinculadas a uma empresa, cuja ficha mostra seus funcionários. Nas novas reservas e entradas, a empresa é sugerida como pagadora e pode ser substituída pelo operador; alterar o vínculo cadastral preserva as operações anteriores.

Consulte o [roteiro do protótipo e da atualização](docs/ENTREGA_SPRINT_1.md). Hospedagem e cobrança empresarial estão na [Sprint 2](docs/ENTREGA_SPRINT_2.md). Pagamentos mistos, recebimentos distribuídos e caixa estão na [Sprint 3](docs/ENTREGA_SPRINT_3.md). Compras, lotes e validade estão na [Sprint 4](docs/ENTREGA_SPRINT_4.md). A [Sprint 6](docs/ENTREGA_SPRINT_6.md) completa a ficha da pessoa, a projeção financeira e a importação inicial com revisão.

A [sprint 1 da revisão de usabilidade](docs/ENTREGA_REVISAO_SPRINT_1.md) concentra o cadastro de bebidas em Cadastros, esclarece total/recebido/saldo e separa indicadores de hospedagem, vendas e recebimentos. O resumo de quartos aparece sempre no Mapa, abaixo das abas. A [sprint 2 da revisão](docs/ENTREGA_REVISAO_SPRINT_2.md) padroniza sub-abas, datas e auditoria e melhora os gráficos e o consumo lateral. Consulte também o [estado da auditoria de dependências](docs/SEGURANCA_DEPENDENCIAS.md).

A [sprint 3](docs/ENTREGA_REVISAO_SPRINT_3.md) adiciona busca e filtros de chegadas, paginação por grupo e contato do hóspede, com um [roteiro de homologação da rotina](docs/HOMOLOGACAO_ROTINA_DIARIA.md).

## Telas do sistema

Conheça quatro abas que representam os principais fluxos da aplicação. As capturas foram feitas em **modo claro**, com dados fictícios da Pousada Sol & Mar. Nomes, valores e operações são exemplos; as datas são calculadas quando a demonstração é criada.

### Mapa — acompanhe a ocupação e a rotina dos quartos

A recepção visualiza quartos disponíveis, ocupados, em limpeza ou bloqueados para manutenção. Cada cartão reúne o hóspede, a previsão de saída, o consumo pendente e uma agenda de sete dias, permitindo identificar a situação da hospedagem sem sair do mapa.

Os filtros ajudam a localizar quartos por situação. A partir dos cartões, é possível iniciar o check-in, consultar o consumo, liberar um quarto após a limpeza e acompanhar bloqueios. O check-out exige a quitação do consumo pendente.

Ao selecionar um dia futuro, o mapa apresenta o planejamento daquela data: **Reservar** abre a reserva com quarto e chegada preenchidos. Reservas, hospedagens e bloqueios previstos oferecem consulta, enquanto recebimentos, consumo, check-out e liberação do quarto permanecem no atendimento atual. Os filtros acompanham a previsão da data selecionada; a disponibilidade depende da saída e da limpeza efetivas no dia.

![Mapa em modo claro com situações dos quartos, hóspedes, consumo e agenda de sete dias](docs/images/mapa-quartos.jpg)

### Frente de Caixa — registre o consumo e organize a venda

O catálogo apresenta os produtos por categoria, com busca por nome ou código de barras. O operador adiciona itens ao carrinho, ajusta quantidades, aplica descontos e seleciona a forma de pagamento para concluir a venda.

Na captura, o carrinho contém uma água e um suco, mostrando como os itens e o total ficam visíveis durante o atendimento. A aba também oferece acesso ao histórico de vendas. O controle de turnos fica nesta aba, com ações explícitas de **Abrir caixa**, **Movimentar**, **Fechar caixa** e **Turnos anteriores**. Vendas e consumo de bebidas exigem caixa aberto em qualquer meio de pagamento. O fechamento separa o resumo por forma de pagamento da conferência do dinheiro físico. Veja o [fluxo de operação do caixa](docs/FLUXO_CAIXA.md).

![Frente de caixa em modo claro com catálogo de bebidas e carrinho de exemplo](docs/images/frente-caixa.jpg)

### Financeiro — controle o que pagar, receber e movimentar

A aba tem quatro seções: **A receber**, **A pagar**, **Movimentações** e **Contas bancárias**. Cobranças e pagamentos mantêm recebimentos parciais, parcelas, conferência e estornos. Saldos, transferências e repasses manuais de cartão ficam em Contas bancárias. Cartões a receber ficam separados do saldo bancário até o repasse; abertura, fechamento e passagem de turno ficam na Frente de Caixa. As recorrências de receita e despesa ficam recolhidas nas respectivas seções.

O resumo de Movimentações acompanha os filtros de tipo e período da própria lista. Pessoas, empresas e fornecedores são gerenciados exclusivamente em **Cadastros**; contas bancárias, centros de custo e categorias ficam em **Cadastros → Financeiros**. O perfil de hospedagem integra a ficha da pessoa. Orçamentos ficam em **Relatórios → Planejamento** e descontos são aplicados na reserva ou hospedagem correspondente, respeitando as permissões existentes. Veja o [guia de organização do Financeiro](docs/ORGANIZACAO_FINANCEIRO.md).

### Relatórios — transforme a operação em indicadores

Consulte hospedagem prestada, bebidas, compras/estoque, fluxo e cobrança e resultado gerencial por período. Os indicadores distinguem atividade, recebimentos, mercadoria recebida e custo consumido; cada linha permite abrir seu documento de origem. Valores estimados, custos ausentes e saldos internos não conciliados são identificados.

CSV e JSON preservam período, totais, critérios e origem, com autorização no servidor e auditoria. Veja os [critérios e o roteiro de homologação da Sprint 5](docs/ENTREGA_SPRINT_5.md).

![Prévia do resultado gerencial com exemplos fictícios em modo claro](docs/images/relatorios-sprint5.png)

### Outras abas

| Aba | O que permite fazer |
| --- | --- |
| **Cadastros** | Gerenciar pessoas, empresas e seus funcionários vinculados, fornecedores, bebidas, capacidade dos quartos e tarifas por pessoa e ocupação. Inclui o perfil de hospedagem da pessoa e os cadastros financeiros de contas, centros de custo e categorias. |
| **Reservas** | Acompanhar quem ainda vai chegar, receber sinal, ajustar datas, realizar check-in e cancelar. Chegadas atrasadas permanecem até serem resolvidas. |
| **Histórico** | Consultar hospedagens encerradas, reservas canceladas e ausências, com busca por hóspede/empresa e filtros de situação e data de entrada. |
| **Estoque** | Receber compras com conta a pagar, converter embalagens, controlar lotes e validade, registrar perdas/devoluções e conferir inventário por corte. Saldo utilizável orienta vendas e alertas de reposição. |
| **Configurações** | Preferências pessoais, dados da pousada, hospedagem, política comercial, alertas, usuários e importação, com acesso por seção. |
| **Auditoria** | Consultar os registros de ações realizadas no sistema. |

Consulte o [guia de Configurações e acessos](docs/CONFIGURACOES_E_ACESSOS.md) para a organização das seções, permissões, salvamento e atualização da instalação.

Reservas feitas para vários quartos aparecem em uma única linha, com os números separados por vírgula, por exemplo **101, 102**. **Abrir grupo** mostra os dados e as ações individuais: check-in, recebimento, edição, cancelamento e ausência seguem vinculados ao quarto escolhido. A linha soma apenas os quartos aguardando chegada; os que já entraram ou foram cancelados continuam identificados nos detalhes do grupo. Se as datas dos quartos forem alteradas separadamente, a linha informa **Datas variadas**.

Após o check-in, a reserva sai da lista de chegadas e o atendimento continua pelo **Mapa**. Após o check-out, a estadia fica no **Histórico**, com extrato de diárias, consumos e pagamentos. Dívidas empresariais continuam em **Financeiro → Contas a receber**, vinculadas à hospedagem. O acesso ao Histórico exige a permissão **Histórico · Acessar hospedagens encerradas e reservas concluídas** e a leitura das respectivas reservas ou hospedagens; a consulta não oferece recebimentos nem alterações.

No mapa de quartos, o nome do hóspede abre o extrato e o saldo abre o recebimento. **Mais ações** reúne troca de quarto, ocupantes e **prorrogação da estadia**, com revisão das novas diárias e da disponibilidade. Veja a [entrega das ações dos quartos](docs/ENTREGA_ACOES_DOS_QUARTOS.md).

No celular, a navegação por sete dias fica sempre disponível, e o período exibido abre o calendário. Cada quarto mostra somente barrinhas coloridas e números dos dias; uma legenda única explica as cores e o toque numa barra apresenta a data e a situação. As setas de semana atualizam o período dos cartões, sem exigir consulta dia a dia.

O vínculo com uma empresa é definido no cadastro da pessoa, inclusive no cadastro rápido. Nas novas reservas e entradas sem reserva, a empresa vinculada ativa é a pagadora por padrão. Somente pessoas vinculadas exibem **Pagar por conta própria, fora da empresa**: marcar essa opção direciona a cobrança ao hóspede, sem desfazer o vínculo. Pessoas sem empresa pagam pela própria hospedagem, sem essa opção adicional. Trocar de hóspede redefine a escolha; reservas já confirmadas preservam seu pagador.

## Demonstração local

### Requisitos

- **Node.js 22.12 ou superior na linha 22**, ou **Node.js 24**.
- **pnpm 10**.
- Git para clonar o repositório.

### Instalação

```bash
git clone https://github.com/GuiMayer/erp-pousada.git
cd erp-pousada
pnpm install --frozen-lockfile
pnpm db:generate
```

Crie um arquivo `.env.local` na raiz com:

```dotenv
NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage
```

Inicie a aplicação:

```bash
pnpm dev
```

Acesse **[http://localhost:3002](http://localhost:3002)**. O modo de demonstração não exige um servidor PostgreSQL. `npm run dev` também executa esse comando. O desenvolvimento usa a porta 3002, reservando 3000 para o sistema normal e 3001 para a demonstração Docker do painel. Ele escuta somente neste computador.

Se `.env` ou `.env.local` definir `APP_URL`, use `APP_URL=http://localhost:3002` no desenvolvimento. Os servidores Docker configurados para Tailscale devem ser acessados pelo link do painel; abrir suas portas locais pode causar **Origem não autorizada**. Reinicie o desenvolvimento após alterar variáveis de ambiente.

### Acesso de demonstração

| Perfil | Usuário | Senha |
| --- | --- | --- |
| Operador | `operador` | `1234` |
| Supervisor | `supervisor` | `adm123` |

Use o perfil supervisor para explorar também o módulo de administração. Essas credenciais pertencem ao login demonstrativo atual.

### Dados de exemplo

Ao entrar na demonstração, o sistema usa o dia atual do navegador, no horário de São Paulo, para montar o cenário:

- **12 quartos** com situações de ocupação, disponibilidade, limpeza e manutenção.
- **17 reservas e 9 hóspedes**, incluindo cinco estadias em andamento, saída atrasada, chegada hoje, três quartos com chegada amanhã (dois no mesmo grupo), reservas nas próximas duas semanas e histórico de saída, cancelamento e ausência.
- **28 produtos** do catálogo da pousada.
- **112 vendas distribuídas em 14 dias**, com lançamentos financeiros correspondentes.
- **12 itens de estoque**, movimentações, alertas de reposição, despesas e contas a receber.

Os exemplos ficam no navegador, sob o prefixo `erp-pousada-demo`, isolados do PostgreSQL. Recarregar, sair/entrar ou reiniciar o servidor preserva alterações no mesmo dia. No próximo dia de acesso, os exemplos são renovados; uma página aberta não é restaurada à meia-noite.

Use `npm run dev:demo` para selecionar esse modo explicitamente. `npm run dev` usa o mesmo modo quando `.env.local` define `NEXT_PUBLIC_DATA_ADAPTER=demo-localStorage`. No login, o pop-up **Acessos da demonstração** permite preencher credenciais e **Restaurar exemplos e descartar alterações**. Para restaurar após testar, saia da conta primeiro.

A mesma demonstração pode ser publicada automaticamente no GitHub Pages. Os testes aprovam a publicação da `main`; PRs apenas validam. Consulte [demonstração web e publicação](docs/DEMONSTRACAO_WEB.md). Cada navegador mantém suas alterações; a demonstração Docker com PostgreSQL conserva seu próprio ciclo de dados.

## Desenvolvimento com PostgreSQL

Para desenvolver a persistência no servidor, crie `.env` com a conexão de banco e ajuste `.env.local` para o modo `database`:

**`.env`**

```dotenv
DATABASE_URL="postgresql://pousada_dev:local-development-only@127.0.0.1:5432/pousada_dev"
```

**`.env.local`**

```dotenv
NEXT_PUBLIC_DATA_ADAPTER=database
```

Com Docker disponível, execute:

```bash
pnpm db:up
pnpm db:generate
pnpm exec prisma migrate deploy
# Defina as credenciais de bootstrap conforme docs/PRODUCAO.md
pnpm db:seed
pnpm dev
```

Reinicie o servidor de desenvolvimento sempre que trocar o modo de dados. O endereço de banco acima corresponde à configuração local de exemplo do Compose.

No modo `database`, o navegador acessa `/api/data`, e as coleções mapeadas são persistidas em tabelas relacionais via Prisma. A persistência operacional usa as tabelas relacionais; o adaptador JSONB e sua ferramenta de conversão foram retirados. Consulte o [mapa do domínio](docs/DATABASE_DOMAIN_MAP.md) para os detalhes da transição.

## Execução com Docker

O projeto inclui aplicação, PostgreSQL e um serviço de backup automático:

```bash
powershell -NoProfile -File scripts/setup-docker.ps1
powershell -NoProfile -File scripts/start-docker.ps1
```

A instalação começa vazia e usa **https://localhost**, com certificado interno que deve ser configurado como confiável. Aplicação, migrações e backups usam credenciais distintas. As migrations são aplicadas por um serviço separado antes da aplicação.

No Windows, siga o [guia de instalação no computador da pousada](docs/INSTALACAO_POUSADA.md), incluindo HTTPS na rede, credencial inicial, backup externo e recuperação. O menu `pousada-menu.bat` reúne preparação, inicialização, verificação e backup.

## Origem da interface

O v0 foi utilizado para criar o primeiro front-end, essencialmente a tela de mapa dos quartos da pousada. Essa interface inicial foi o ponto de partida visual, não uma geração do ERP completo. O projeto evoluiu com módulos de gestão, regras de negócio, API, persistência com Prisma/PostgreSQL, autenticação, permissões, auditoria, testes e ferramentas de operação, descritos neste repositório.

## Tecnologias e organização

| Camada | Tecnologias |
| --- | --- |
| Aplicação | Next.js 16, App Router, React 19 e TypeScript |
| Interface | Tailwind CSS 4, componentes shadcn/ui, Radix UI e Lucide |
| Dados | React Context, repositórios, API interna, Prisma 7 e PostgreSQL 16 |
| Gráficos e documentos | Recharts, jsPDF e exportação CSV |
| Testes | Vitest, React Testing Library e Happy DOM |
| Instalação | Docker Compose e ferramentas de backup/restauração |

```text
app/                   Página principal e rotas da API
components/            Telas, módulos e componentes de interface
contexts/              Preferências e navegação
lib/
  data/                Adaptadores e repositórios
  db/                  Cliente Prisma
  hooks/               Lógica compartilhada dos módulos
  server/              Persistência e serviços no servidor
  demo-data.ts         Exemplos do modo de demonstração
  store.ts             Tipos e dados iniciais
prisma/                Schema e migrations
scripts/               Migração de dados e manutenção do banco
docs/                  Documentação técnica e capturas de tela
src/__tests__/         Testes automatizados
```

## Comandos úteis

| Comando | Finalidade |
| --- | --- |
| `pnpm dev` | Iniciar o servidor de desenvolvimento |
| `pnpm build` | Gerar o build da aplicação |
| `pnpm start` | Executar um build existente |
| `pnpm exec vitest run` | Executar a suíte de testes uma vez |
| `pnpm test` | Executar os testes em modo interativo |
| `pnpm test:ui` | Abrir a interface do Vitest |
| `pnpm db:generate` | Gerar o cliente Prisma |
| `pnpm db:migrate` | Criar/aplicar migrations durante o desenvolvimento |
| `pnpm exec prisma migrate deploy` | Aplicar migrations já versionadas |
| `pnpm db:studio` | Inspecionar o banco pelo Prisma Studio |
| `pnpm db:logs` | Acompanhar os logs do PostgreSQL local |

## Estado atual

- **Acesso:** no modo `database`, o servidor autentica usuários, protege as APIs e aplica permissões. Senhas são gravadas com bcrypt e não são devolvidas ao navegador. Sessões usam cookies HttpOnly e expiram em oito horas. Mudanças de perfil e permissões valem nas próximas requisições; desativação e troca de senha encerram as sessões. Há perfis por setor, exceções individuais e aprovações vinculadas a uma única operação.
- **Operações:** vendas, estornos, check-in, reservas, consumo, estoque e pagamentos de despesas usam operações no servidor. Vendas recalculam valores e aplicam os limites de desconto. Operações possuem transação e identificação de reenvios.
- **Hospedagem e cobrança:** a conta acompanha a estadia durante a troca de quarto e depois da saída. O extrato conserva bebidas e recebimentos. Saída empresarial autorizada gera cobrança pelo saldo, com vencimento e recebimento parcial posterior; próxima ocupação começa sem a dívida anterior. Veja o [roteiro da Sprint 2](docs/ENTREGA_SPRINT_2.md).
- **Dados iniciais:** a produção começa vazia. O seed cria somente o primeiro supervisor e as configurações, exigindo credenciais definidas pelo responsável. A demonstração permanece separada.
- **Fechamento S6:** ficha com saldos parciais e origens, carrinho por estoque utilizável, projeção diária com reservas separadas, alertas que abrem o registro, busca por telefone, orientação de preço e cache CNPJ. Importação CSV exige prévia/revisão, permissão própria e confirmação sem duplicar aberturas. [Guia e limites](docs/ENTREGA_SPRINT_6.md).
- **Verificação:** tipos e build não ignoram erros. O projeto inclui lint, testes unitários, integração com PostgreSQL e uma rotina de CI no GitHub.

Para instalar com dados reais, siga o [guia de produção](docs/PRODUCAO.md), configure domínio e segredos, valide a cópia externa de backups e conclua a homologação dos fluxos da pousada. A configuração do repositório não comprova que uma infraestrutura remota já esteja implantada ou monitorada.

## Documentação

- [Requisitos da pousada e sequência revisada das sprints](docs/REQUISITOS_E_MODELAGEM_ERP.md)
- [Sprint 2: hospedagem, cobrança empresarial e roteiro de teste](docs/ENTREGA_SPRINT_2.md)
- [Sprint 3: PDV, pagamentos, recebimentos e caixa](docs/ENTREGA_SPRINT_3.md)
- [Sprint 5: critérios gerenciais, homologação e recuperação](docs/ENTREGA_SPRINT_5.md)
- [Sprint 6: ficha, projeção, alertas e importação inicial](docs/ENTREGA_SPRINT_6.md)
- [Produção, HTTPS, atualização e backups](docs/PRODUCAO.md)
- [Regras de hospedagem, cancelamentos, pagamentos e estoque](docs/REGRAS_NEGOCIO.md)
- [Permissões individuais, perfis e aprovações por operação](docs/PERMISSOES.md)
- [Concorrência, conflitos de edição e sincronização entre dispositivos](docs/CONCORRENCIA.md)
- [Instalação local no Windows](docs/CLIENTE_INSTALACAO_DOCKER.md)
- [Camada de dados e repositórios](docs/DATA_LAYER.md)
- [Mapa da migração relacional](docs/DATABASE_DOMAIN_MAP.md)
- [Configuração local da instalação](config/README.md)
- [Histórico da refatoração](docs/history/REFACTORING.md)

## Contribuição e licença

Para contribuir, abra uma issue descrevendo o problema ou a proposta e envie um pull request com contexto e validação da alteração. Mantenha os exemplos fictícios e documente mudanças de configuração ou persistência.

Este projeto é distribuído sob a [licença MIT](LICENSE). As dependências e demais materiais de terceiros mantêm suas respectivas licenças.

### Notificações

Eventos confirmados e alertas operacionais possuem histórico no PostgreSQL, leitura individual e acesso conforme as permissões atuais. O worker Docker mantém os lembretes sem navegador conectado. Consulte [o guia da central](docs/NOTIFICACOES.md).

Consulte [Auditoria e logs](docs/LOGS.md) para filtros do histórico, diagnóstico de erros e política de retenção.

Para apresentações sem alterar os dados operacionais, consulte [Demonstração temporária](docs/DEMONSTRACAO.md).

A [entrega da Sprint 4](docs/ENTREGA_SPRINT_4.md) explica compras, lotes, inventário e a revisão de abertura exigida para saldos anteriores.
