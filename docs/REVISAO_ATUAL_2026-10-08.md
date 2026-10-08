# Revisão funcional — 8 de outubro de 2026

## Conclusão

O sistema passou nas verificações executadas, mas não pode ser considerado 100% validado. Foram confirmados dois defeitos de data/fuso, além de pontos de operação que precisam de revisão antes de uso definitivo. Esta revisão não alterou os dados operacionais nem aplicou correções no aplicativo.

## Evidências executadas

- TypeScript e lint: aprovados.
- 250 testes unitários em 29 arquivos: aprovados.
- 92 testes de integração em 6 arquivos: aprovados, usando PostgreSQL 16 em um container exclusivo, banco `erp_test`.
- Aplicação de todas as 11 migrações e permissões separadas de aplicação, migração, backup e notificações: aprovada no banco de teste.
- Dependências de produção: consulta do `pnpm audit` retornou zero vulnerabilidades conhecidas nas categorias consultadas. Isso não equivale a uma auditoria completa de segurança.
- Restauração do backup operacional mais recente em `erp_restore`, dentro do container de revisão, com `pg_restore --exit-on-error --single-transaction`: concluída. O banco operacional atual não tinha quartos nesse backup; a restauração confirma o procedimento e a integridade do arquivo, sem representar homologação com grande volume de dados.
- Backups locais recentes e marcadores `last-local-success` e `last-success`: presentes. Destino externo e alerta externo: não configurados.
- Login `teste` / `teste` na demonstração pelo HTTPS do Tailscale: aprovado, inclusive no navegador.
- Estados dos aplicativos e acesso HTTPS pelo painel: disponíveis para normal e demonstração.
- Inspeção visual da demonstração: mapa, relatórios, financeiro e notificações carregaram. Não houve erros ou avisos capturados no console durante essas verificações.
- O container de revisão e seu volume temporário foram removidos ao terminar. O normal e a demonstração continuam em execução.

## Defeitos confirmados

### 1. Relatórios de vendas perdem o instante da venda

**Prioridade: corrigir antes da produção.**

Em `lib/server/db/mappers.ts:466`, o mapeamento de vendas converte o instante para somente `AAAA-MM-DD`. Em `lib/hooks/useReports.ts:235`, a distribuição por hora calcula a hora a partir desse valor incompleto e ainda depende do fuso do dispositivo.

Reprodução pelo mapeamento real: uma venda em `2026-10-09T01:00:00Z` pertence a `2026-10-08` em São Paulo. A API retorna `2026-10-09`, e o relatório passa a considerá-la no dia seguinte. Na demonstração, vendas gravadas às `15:00:00` no banco são devolvidas somente como `2026-10-08`.

**Impacto:** horário das vendas incorreto, vendas noturnas associadas ao dia errado e exportação JSON perdendo precisão temporal das vendas. Valores registrados e saldos não são alterados por esse mapeamento, mas relatórios por período ficam incorretos. Transferências bancárias também usam uma conversão para data sem horário e devem entrar na revisão de campos temporais.

**Correção indicada:** preservar ISO completo para eventos; usar `America/Sao_Paulo` para agrupamentos de dia e hora. Reservas e vencimentos que representam datas de calendário devem continuar como datas, sem conversão indevida. Adicionar regressões para horários noturnos, exportação/importação e diferentes fusos do navegador.

### 2. Limite mensal de consumo de funcionários usa o fuso do servidor

**Prioridade: corrigir antes da produção.**

Em `lib/server/operations.ts:327`, os limites mensais são delimitados por `getFullYear()` / `getMonth()` e construtores `Date` no fuso do processo. O container operacional está em UTC.

Reprodução no container: em `2026-11-01T01:00:00Z`, o servidor considera novembro, mas em São Paulo ainda é `2026-10-31`. O limite passa para o mês seguinte às 21h do último dia do mês local. Consumos entre 21h e meia-noite podem ser somados ao mês errado.

**Correção indicada:** calcular início e fim do mês operacional em São Paulo e convertê-los em instantes para consultar o banco. Testar a virada do mês e requisições concorrentes nesse limite.

## Pontos operacionais a revisar

### 3. Falta proteção contra perda do computador dos backups

**Prioridade: necessária antes da operação definitiva.**

O backup local está funcionando e foi restaurado com sucesso. Entretanto, o worker confirmou que `BACKUP_REMOTE` e `ALERT_WEBHOOK_URL` não estão configurados. Falha ou perda do computador pode levar banco e cópias locais juntos; não há aviso externo de falha de backup configurado.

**Ação indicada:** configurar uma cópia externa criptografada e um aviso de falha; validar a recuperação dessa cópia em outro computador. O recurso já existe nos scripts, portanto é principalmente uma etapa de instalação, não uma nova arquitetura.

### 4. Painel precisa limitar operações que não terminam

**Prioridade: melhoria de confiabilidade.**

Os comandos externos de Docker e Tailscale são executados sem um prazo máximo em `server-panel-worker.ps1` e `server-panel-network.ps1`. O painel espera a saída do processo para reabilitar os controles. Há prazo para a saúde do aplicativo, mas isso não cobre um comando externo travado antes dessa etapa.

**Impacto possível:** operação permanece em andamento e os botões de controle ficam bloqueados quando o motor Docker ou serviço Tailscale deixa de responder. Este cenário foi identificado pela arquitetura, sem travar deliberadamente o serviço operacional.

**Ação indicada:** prazo por comando e prazo global, indicação do estágio atual, diagnóstico preservado e possibilidade de cancelar apenas o processo auxiliar do painel. Cancelamento deve indicar que serviços podem ter iniciado parcialmente e atualizar seus estados; nunca deve finalizar o Docker inteiro ou apagar o banco.

### 5. As alterações recentes ainda não estão registradas no Git

O painel, o guia correspondente e a correção de credenciais da demonstração estão modificados ou não rastreados. Há também arquivos gerados do Next/TypeScript modificados. Isso não impede o funcionamento local, mas outra instalação obtida do Git não reproduz todos esses recursos.

**Ação indicada:** revisar o diff, separar os arquivos gerados e registrar/publicar as alterações após as correções. Nenhum push foi feito nesta revisão.

## Cobertura atual dos módulos

| Área | Evidência | Resultado e limite |
|---|---|---|
| Login e usuários | Testes de sessões, senha, revogação e limites; login HTTPS real | Aprovados nos cenários executados |
| Permissões | Testes de chamadas diretas, perfis individuais e aprovação vinculada à operação | Aprovados |
| Reservas e hospedagem | Testes de sobreposição, grupos, bloqueios, check-in, quitação, cancelamento, multa e crédito | Aprovados; mapa inspecionado no navegador |
| PDV e restaurante | Testes de venda, estoque, estorno, versões de comanda, preços e descontos | Regras testadas aprovadas; relatórios de venda exigem correção temporal |
| Financeiro e caixa | Testes de pagamentos parciais, parcelas, conta bancária, caixa compartilhado e transferências | Aprovados nos cenários executados; tela financeira carregou |
| Estoque e produção | Testes de saldo, concorrência e conversão de unidades | Aprovados. Produção não gera estoque de produto acabado; é uma limitação já documentada |
| Consumo de funcionários | Revisão do fluxo de benefício/desconto/pagamento | Limite mensal precisa de correção de fuso |
| Notificações | Testes de eventos, permissões, preferências, leitura e arquivamento; inbox visível | Aprovados nos cenários executados |
| Auditoria | Testes de imutabilidade, sanitização, paginação e contexto de requisições | Aprovados |
| Múltiplos usuários | Testes de versão, reenvio idempotente, rollback e SSE, inclusive dez leitores | Aprovados; não representa teste de capacidade da máquina final |
| Relatórios | Interface carregou; comparação banco/API e reprodução de venda noturna | Defeito confirmado em datas/horários; PDFs e CSVs de todos os módulos não foram homologados nesta revisão |
| Docker, demo e acesso | Serviços saudáveis, links HTTPS e login validado; scripts revisados | Funcionando nos caminhos verificados; recuperação de travamento do painel precisa de melhoria |
| Backup | Cópias locais e restauração real em banco separado | Aprovado localmente; falta destino externo |

## Verificações ainda necessárias para liberação

- Corrigir os dois defeitos temporais e acrescentar as regressões correspondentes.
- Homologar os formulários e exportações de ponta a ponta, incluindo uso no celular, sem presumir cobertura total pelos testes de servidor.
- Testar reinício completo de Windows, Docker e Tailscale na máquina da pousada. Esta revisão não desligou o computador nem os serviços normais.
- Testar volume representativo, lentidão, perda/reconexão de rede e recuperação do servidor. Os testes atuais validam integridade e concorrência, não a capacidade máxima.
- Validar backup externo e restauração completa com usuários, configurações e dados representativos. A exportação JSON da interface não é equivalente ao backup completo PostgreSQL.

O ERP operacional requer conexão com seu servidor; fila de gravações offline, emissão fiscal e conciliação de adquirentes não fazem parte dos fluxos operacionais implementados. Essas ausências devem ser tratadas como limites do produto, não como funcionalidades aprovadas nesta revisão.

## Implementação posterior à revisão

Os pontos 1 e 2 foram corrigidos com preservação de instantes e funções centrais de hora/mês operacional. O painel recebeu prazo por comando, cancelamento cooperativo, prazo total, etapas e diagnóstico. O backup ganhou segunda pasta configurável, validação da cópia, bloqueio para execução simultânea e estado visível. A segunda pasta inicial é local; sincronização externa deve ser configurada e verificada pelo responsável. A homologação completa do celular, reinício do Windows e recuperação em outra máquina permanece necessária.

Validação das correções: 253 testes unitários e 93 de integração aprovados; prazo/cancelamento prévio e durante comando aprovados no Windows; cópia secundária comparada e restaurada com sucesso; destino indisponível conservou o backup principal e sinalizou falha, e a tentativa seguinte limpou o erro. Tipos, lint e auditoria de dependências aprovados.
