<div align="center">

# ERP Pousada

**Hospedagem, restaurante e gestão financeira em um só painel.**

Aplicação web em português para organizar a rotina de pousadas: da reserva ao fechamento de caixa, com controle de consumo, estoque e relatórios.

[Conheça as telas](#telas-do-sistema) · [Execute a demonstração](#demonstração-local) · [Configure o banco](#desenvolvimento-com-postgresql) · [Documentação](#documentação)

**Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 · PostgreSQL 16**

</div>

## Visão geral

O ERP Pousada reúne a recepção, a frente de caixa, o restaurante e o financeiro em uma interface compartilhada. Os módulos trabalham com quartos, hóspedes, produtos e lançamentos para acompanhar a operação do estabelecimento.

O projeto está em desenvolvimento. Há um modo de demonstração sem banco e uma camada de persistência com PostgreSQL; consulte o [estado atual](#estado-atual) antes de planejar uma instalação operacional.

## Telas do sistema

Conheça cinco abas que representam os principais fluxos da aplicação. As capturas foram feitas em **modo claro**, com dados fictícios da Pousada Sol & Mar. Nomes, valores e operações são exemplos; as datas são calculadas quando a demonstração é criada.

### Mapa — acompanhe a ocupação e a rotina dos quartos

A recepção visualiza quartos disponíveis, ocupados, em limpeza ou bloqueados para manutenção. Cada cartão reúne o hóspede, a previsão de saída, o consumo pendente e uma agenda de sete dias, permitindo identificar a situação da hospedagem sem sair do mapa.

Os filtros ajudam a localizar quartos por situação. A partir dos cartões, é possível iniciar o check-in, consultar o consumo, liberar um quarto após a limpeza e acompanhar bloqueios. O check-out exige a quitação do consumo pendente.

![Mapa em modo claro com situações dos quartos, hóspedes, consumo e agenda de sete dias](docs/images/mapa-quartos.jpg)

### Frente de Caixa — registre o consumo e organize a venda

O catálogo apresenta os produtos por categoria, com busca por nome ou código de barras. O operador adiciona itens ao carrinho, ajusta quantidades, aplica descontos e seleciona a forma de pagamento para concluir a venda.

Na captura, o carrinho contém uma água e um suco, mostrando como os itens e o total ficam visíveis durante o atendimento. A aba também oferece acesso ao histórico de vendas.

![Frente de caixa em modo claro com catálogo de bebidas e carrinho de exemplo](docs/images/frente-caixa.jpg)

### Restaurante — gerencie mesas e comandas

O mapa de mesas diferencia lugares livres, ocupados e reservados. Nas mesas em atendimento, os cartões mostram a comanda, a quantidade de itens e o valor acumulado, facilitando o acompanhamento do salão.

Ao acessar uma mesa, o operador pode lançar pedidos e fechar a comanda. O módulo também reúne fichas de receita, produção e consumo de funcionários para apoiar a rotina da cozinha.

![Restaurante em modo claro com dez mesas e três comandas fictícias em aberto](docs/images/restaurante.jpg)

### Financeiro — acompanhe resultados e vencimentos

O painel reúne receitas, despesas, resultado líquido e estornos. A lista de lançamentos permite consultar categorias, valores, vencimentos e situações de pagamento, ajudando a identificar contas pendentes e organizar o fluxo financeiro.

Além do resumo, a aba oferece controle de despesas e parcelas, contas a receber, clientes, fornecedores e fechamento de turno.

![Financeiro em modo claro com resumo de receitas e despesas e lançamentos de exemplo](docs/images/financeiro.jpg)

### Relatórios — transforme a operação em indicadores

Selecione um período para consultar receita, quantidade de vendas, ticket médio e alertas de estoque. Os gráficos mostram a distribuição por categoria, forma de pagamento e horário, permitindo comparar o movimento e reconhecer os produtos que contribuem para as vendas.

As visualizações de vendas, produtos e estoque complementam a análise. Os dados podem ser exportados em CSV, e os relatórios de reservas, estoque e restaurante estão disponíveis em PDF.

![Relatórios em modo claro com indicadores, gráficos de vendas e exportação CSV e PDF](docs/images/relatorios.jpg)

### Outras abas

| Aba | O que permite fazer |
| --- | --- |
| **Reservas** | Cadastrar e editar hospedagens, verificar conflitos de período, acompanhar cancelamentos, no-show e histórico de hóspedes. |
| **Estoque** | Consultar produtos e cardápio, registrar entradas, saídas, ajustes e perdas, e acompanhar alertas de estoque mínimo. |
| **Configurações** | Ajustar os dados do estabelecimento e as preferências da interface. |
| **Administração** | Gerenciar o cadastro de usuários. |
| **Auditoria** | Consultar os registros de ações realizadas no sistema. |

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

Acesse **[http://localhost:3000](http://localhost:3000)**. O modo de demonstração não exige um servidor PostgreSQL.

### Acesso de demonstração

| Perfil | Usuário | Senha |
| --- | --- | --- |
| Operador | `operador` | `1234` |
| Supervisor | `supervisor` | `adm123` |

Use o perfil supervisor para explorar também o módulo de administração. Essas credenciais pertencem ao login demonstrativo atual.

### Dados de exemplo

Na primeira abertura de um armazenamento de demonstração vazio, o sistema carrega:

- **12 quartos** com situações de ocupação, disponibilidade, limpeza e manutenção.
- **10 reservas e 9 hóspedes**, incluindo estadias em andamento e reservas futuras.
- **36 produtos**, sendo 28 do catálogo da pousada e 8 do cardápio do restaurante.
- **10 mesas e 3 comandas abertas** com itens e totais relacionados.
- **112 vendas distribuídas em 14 dias**, com lançamentos financeiros correspondentes.
- **12 itens de estoque**, movimentações, alertas de reposição, despesas e contas a receber.

Os exemplos ficam no navegador, sob o prefixo `erp-pousada-demo`. A carga inicial preserva um armazenamento já preenchido e mantém as antigas chaves `pousada:*` intactas. As alterações na demonstração continuam disponíveis após recarregar a página, no mesmo navegador e endereço.

Para uma nova demonstração, use um perfil de navegador sem dados anteriores. A implementação dos exemplos está em [`lib/demo-data.ts`](lib/demo-data.ts).

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

No modo `database`, o navegador acessa `/api/data`, e as coleções mapeadas são persistidas em tabelas relacionais via Prisma. O adaptador JSONB legado permanece apenas para migração. Consulte o [mapa do domínio](docs/DATABASE_DOMAIN_MAP.md) para os detalhes da transição.

## Execução com Docker

O projeto inclui aplicação, PostgreSQL e um serviço de backup automático:

```bash
powershell -NoProfile -File scripts/setup-docker.ps1
powershell -NoProfile -File scripts/start-docker.ps1
```

A instalação começa vazia e usa **https://localhost**, com certificado interno que deve ser configurado como confiável. Aplicação, migrações e backups usam credenciais distintas. As migrations são aplicadas por um serviço separado antes da aplicação.

No Windows, siga o [guia de instalação no computador da pousada](docs/INSTALACAO_POUSADA.md), incluindo HTTPS na rede, credencial inicial, backup externo e recuperação. O menu `pousada-menu.bat` reúne preparação, inicialização, verificação e backup.

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
- **Operações:** vendas, estornos, check-in, reservas, consumo, comandas, estoque, produção e pagamentos de despesas usam operações no servidor. Vendas recalculam valores e aplicam os limites de desconto. Operações possuem transação e identificação de reenvios.
- **Dados iniciais:** a produção começa vazia. O seed cria somente o primeiro supervisor e as configurações, exigindo credenciais definidas pelo responsável. A demonstração permanece separada.
- **Verificação:** tipos e build não ignoram erros. O projeto inclui lint, testes unitários, integração com PostgreSQL e uma rotina de CI no GitHub.

Para instalar com dados reais, siga o [guia de produção](docs/PRODUCAO.md), configure domínio e segredos, valide a cópia externa de backups e conclua a homologação dos fluxos da pousada. A configuração do repositório não comprova que uma infraestrutura remota já esteja implantada ou monitorada.

## Documentação

- [Produção, HTTPS, atualização e backups](docs/PRODUCAO.md)
- [Regras de hospedagem, cancelamentos, pagamentos e estoque](docs/REGRAS_NEGOCIO.md)
- [Permissões individuais, perfis e aprovações por operação](docs/PERMISSOES.md)
- [Instalação local no Windows](docs/CLIENTE_INSTALACAO_DOCKER.md)
- [Camada de dados e repositórios](docs/DATA_LAYER.md)
- [Mapa da migração relacional](docs/DATABASE_DOMAIN_MAP.md)
- [Configuração local da instalação](config/README.md)
- [Histórico da refatoração](REFACTORING.md)

## Contribuição e licença

Para contribuir, abra uma issue descrevendo o problema ou a proposta e envie um pull request com contexto e validação da alteração. Mantenha os exemplos fictícios e documente mudanças de configuração ou persistência.

O repositório ainda não possui um arquivo de licença. A disponibilização pública do código não substitui a definição de uma licença de uso e distribuição.

### Notificações

Eventos confirmados e alertas operacionais possuem histórico no PostgreSQL, leitura individual e acesso conforme as permissões atuais. O worker Docker mantém os lembretes sem navegador conectado. Consulte [o guia da central](docs/NOTIFICACOES.md).
