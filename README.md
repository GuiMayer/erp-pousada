<div align="center">

# ERP Pousada

**Hospedagem, restaurante e gestão financeira em um só painel.**

Aplicação web em português para organizar a rotina de pousadas: da reserva ao fechamento de caixa, com controle de consumo, estoque e relatórios.

[Conheça as telas](#telas-do-sistema) · [Execute a demonstração](#demonstração-local) · [Configure o banco](#desenvolvimento-com-postgresql) · [Documentação](#documentação)

**Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 · PostgreSQL 16**

</div>

![Mapa de quartos do ERP Pousada com ocupação, hóspedes e agenda de sete dias](docs/images/mapa-quartos.jpg)

*Captura real da aplicação, com dados fictícios da Pousada Sol & Mar.*

## Visão geral

O ERP Pousada reúne a recepção, a frente de caixa, o restaurante e o financeiro em uma interface compartilhada. Os módulos trabalham com quartos, hóspedes, produtos e lançamentos para acompanhar a operação do estabelecimento.

O projeto está em desenvolvimento. Há um modo de demonstração sem banco e uma camada de persistência com PostgreSQL; consulte o [estado atual](#estado-atual) antes de planejar uma instalação operacional.

## Funcionalidades

| Módulo | Recursos disponíveis |
| --- | --- |
| **Hospedagem** | Mapa de quartos, agenda de sete dias, filtros por situação, check-in, check-out, limpeza e bloqueios de manutenção. |
| **Reservas e hóspedes** | Cadastro e edição de reservas, verificação de conflitos de período, cancelamento, no-show e histórico de hóspedes. |
| **Consumo e frente de caixa** | Catálogo por categoria, busca por produto ou código de barras, carrinho, descontos, formas de pagamento e histórico de vendas. |
| **Restaurante** | Mapa de mesas, comandas, lançamento de itens, fechamento de pedidos, fichas de receita, produção e consumo de funcionários. |
| **Estoque** | Catálogo de produtos, cardápio do restaurante, entradas, saídas, ajustes, perdas e alertas de estoque mínimo. |
| **Financeiro** | Receitas, despesas, vencimentos, parcelas, estornos, fechamento de turno, clientes, fornecedores e contas a receber. |
| **Relatórios** | Indicadores de vendas, ticket médio, gráficos por período, categorias e formas de pagamento, exportação CSV e relatórios PDF. |
| **Administração** | Cadastros de usuários, configurações do estabelecimento, registros de auditoria e preferências de interface. |

## Telas do sistema

As imagens abaixo foram capturadas na aplicação em execução. Nomes, valores e operações são exemplos fictícios; as datas são calculadas quando a demonstração é criada.

<details>
<summary><strong>Reservas — hóspedes, períodos e situação de cada hospedagem</strong></summary>

![Lista de reservas com hóspedes fictícios, quartos, datas e valores](docs/images/reservas.jpg)

</details>

<details>
<summary><strong>Frente de caixa — catálogo de produtos e carrinho de venda</strong></summary>

![Frente de caixa com produtos por categoria e um carrinho de exemplo](docs/images/frente-caixa.jpg)

</details>

<details>
<summary><strong>Restaurante — mesas livres, reservadas e comandas em aberto</strong></summary>

![Restaurante com dez mesas e três comandas fictícias em aberto](docs/images/restaurante.jpg)

</details>

<details>
<summary><strong>Financeiro — resultado da operação e controle de vencimentos</strong></summary>

![Painel financeiro com receitas, despesas e contas de exemplo](docs/images/financeiro.jpg)

</details>

<details>
<summary><strong>Estoque — saldos, custos e alertas de reposição</strong></summary>

![Estoque com doze produtos, custos médios e alertas de reposição](docs/images/estoque.jpg)

</details>

<details>
<summary><strong>Relatórios — indicadores, evolução das vendas e exportação</strong></summary>

![Relatório semanal com indicadores, gráfico de receita e opções de exportação CSV e PDF](docs/images/relatorios.jpg)

</details>

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
DATABASE_URL="postgresql://pousada:pousada@localhost:5432/pousada"
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
pnpm dev
```

Reinicie o servidor de desenvolvimento sempre que trocar o modo de dados. O endereço de banco acima corresponde à configuração local de exemplo do Compose.

No modo `database`, o navegador acessa `/api/data`, e as coleções mapeadas são persistidas em tabelas relacionais via Prisma. O adaptador JSONB legado permanece como caminho de migração e fallback. Consulte o [mapa do domínio](docs/DATABASE_DOMAIN_MAP.md) para os detalhes da transição.

## Execução com Docker

O projeto inclui aplicação, PostgreSQL e um serviço de backup automático:

```bash
docker compose up -d --build
```

A aplicação fica disponível em **[http://localhost:3000](http://localhost:3000)**. Libere a porta 3000 caso outra instância local já esteja em execução. As migrations são aplicadas na inicialização do container da aplicação.

No Windows, `pousada-menu.bat` reúne instalação, acesso na rede local, configuração de backups e restauração. O procedimento completo está no [guia de instalação com Docker](docs/CLIENTE_INSTALACAO_DOCKER.md).

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

- **Autenticação:** o login da interface ainda usa usuários demonstrativos definidos no cliente. O cadastro administrativo de usuários não substitui esse fluxo por uma sessão autenticada no servidor.
- **Inicialização do banco:** a aplicação ainda pode inserir dados iniciais quando não encontra quartos no modo `database`. O comando `pnpm db:seed` é atualmente um placeholder. A carga ampliada descrita neste README é exclusiva do modo de demonstração.
- **Qualidade:** existem testes automatizados, mas a suíte geral e a verificação completa de tipos têm pendências. O build está configurado para ignorar erros de TypeScript; um build concluído não equivale a uma verificação de tipos aprovada.

Esses pontos fazem parte da evolução do projeto e precisam ser tratados antes de usar o sistema com dados reais em uma implantação pública.

## Documentação

- [Instalação no Windows, Docker e backups](docs/CLIENTE_INSTALACAO_DOCKER.md)
- [Camada de dados e repositórios](docs/DATA_LAYER.md)
- [Mapa da migração relacional](docs/DATABASE_DOMAIN_MAP.md)
- [Configuração local da instalação](config/README.md)
- [Histórico da refatoração](REFACTORING.md)

## Contribuição e licença

Para contribuir, abra uma issue descrevendo o problema ou a proposta e envie um pull request com contexto e validação da alteração. Mantenha os exemplos fictícios e documente mudanças de configuração ou persistência.

O repositório ainda não possui um arquivo de licença. A disponibilização pública do código não substitui a definição de uma licença de uso e distribuição.
