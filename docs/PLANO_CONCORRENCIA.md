# Plano de concorrência e sincronização entre usuários

Data: 08/10/2026. Estado: implementação entregue e validada em banco de teste e demonstração. Consulte [comportamento implementado e operação](CONCORRENCIA.md) para contratos, limites e homologação da instalação.

## Objetivo e limites

Evitar sobrescritas silenciosas, pagamentos duplicados, estoque negativo e reservas incompatíveis; preservar o trabalho digitado; atualizar outros dispositivos rapidamente. Manter Next.js, Prisma e PostgreSQL no Docker local, com acesso opcional por Tailscale. O banco continua sendo a autoridade sobre os dados, mesmo quando uma tela está desatualizada.

Não incluir Redis, Kafka, Kubernetes, microsserviços, sincronização offline ou bloqueio de formulários por minutos. Essas dependências não são necessárias para esta instalação. Atualizações instantâneas são uma melhoria de usabilidade, não a garantia de integridade.

## Diagnóstico do código atual

- `prisma/schema.prisma`: diversos modelos já possuem `recordVersion`; comandas também possuem `version`. Precisamos definir o papel de cada versão, sem confundir versão de receita com versão de concorrência.
- `lib/server/db/relational-data-service.ts`: updates genéricos verificam versão quando há ator e modelo versionado, incrementam a versão e executam transação Serializable. A exclusão genérica não recebe uma versão esperada.
- `lib/data/repositories/base-repository.ts`: quando a edição não fornece versão, usa a do registro buscado ao salvar. Isso pode esconder a defasagem de um formulário que ficou aberto. Há fallback equivalente no repositório de hóspedes.
- Alguns formulários, como administração de usuários, clientes e produtos, já enviam versão. Ainda é necessário conferir se o valor é congelado na abertura, e não atualizado por props durante a edição, além de cobrir todos os fluxos.
- `lib/server/operations.ts`: reserva e comanda têm verificações específicas; operações usam Serializable, até três tentativas e recibo idempotente por usuário/requestId. Estoque e saldos usam incrementos/decrementos condicionais. Nem todas as alterações de domínio incrementam as versões dos cadastros afetados.
- O executor repete tanto P2034 quanto P2002. É preciso distinguir falha transitória de concorrência de violação permanente de unicidade; esta última não deve ser repetida indiscriminadamente.
- Adaptador HTTP converte falhas em Error com texto, perdendo informações úteis para uma interface específica de conflito.
- `lib/app-context.tsx`: recarrega os dados após operações, por foco e a cada 15 segundos com página visível. Não há canal de atualização imediata entre dispositivos.
- Já há testes de concorrência para venda/estoque e recebimento. Expandir essa base com PostgreSQL real e sessões distintas.

Esses achados mostram cobertura parcial, não ausência de proteção. Serializable protege as transações concorrentes; não identifica sozinho que um formulário foi aberto antes de uma alteração já confirmada.

## Referências e adaptação

1. **Microsoft Dataverse:** permite validar a versão do registro em atualização e exclusão. Adotar o princípio de comparar com a versão originalmente lida, em todas as edições humanas. Referência: [controle otimista](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/optimistic-concurrency). Dataverse é uma plataforma da Microsoft, não uma descrição de todos os módulos de Dynamics.
2. **Dynamics 365 Business Central:** reduz bloqueios de leitura com tri-state locking e mantém bloqueios explícitos quando necessários. Adotar transações curtas e proteção direcionada; não copiar os níveis de isolamento do SQL Server para PostgreSQL. Referência: [tri-state locking](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-tri-state-locking).
3. **Odoo 19:** o executor repete transações após determinadas falhas de concorrência, com rollback, limite e espera aleatória crescente; distingue erros de integridade. Adotar retry limitado para falhas transitórias, preservando idempotência. Referência: [código oficial do executor](https://github.com/odoo/odoo/blob/19.0/odoo/service/model.py).
4. **PostgreSQL/Prisma:** transações Serializable podem abortar e exigir repetição da transação inteira. Manter o nível atual até testes e medições justificarem ajustes. Referências: [PostgreSQL](https://www.postgresql.org/docs/16/transaction-iso.html), [Prisma](https://www.prisma.io/docs/orm/fundamentals/transactions).

Estas referências justificam os mecanismos propostos. Não afirmam que todos esses produtos têm a mesma interface de conflitos ou adotam SSE; essas escolhas são específicas deste projeto.

## Fase 1 — Contrato de gravação e versões

1. Inventariar cada coleção/ação: edição de cadastro, operação de negócio, exclusão, importação, worker e manutenção. Registrar onde lê/grava e quais versões e permissões precisa validar.
2. Congelar a versão e o estado inicial ao abrir um formulário. Exigir versão explícita nas edições do modo database; remover o fallback que busca uma versão nova no momento de salvar. O refresh das listas não pode trocar a versão-base de um rascunho aberto.
3. Fazer updates condicionais por identificação + versão esperada, com incremento atômico. Zero linhas alteradas deve resultar em conflito ou registro removido. Preservar a transação quando houver filhos, auditoria ou regras relacionadas; falha deve desfazer tudo.
4. Definir `recordVersion` como token de concorrência dos cadastros. Nas comandas, manter temporariamente `version` como token do agregado e assegurar incremento em toda mudança pertinente, inclusive itens, desconto, estado e pagamento. Não criar um segundo token independente para a mesma edição.
5. Todas as mutações que afetam dados editáveis devem incrementar a versão correspondente, inclusive check-in/check-out, estoque, recebimentos e workers que realmente alterem o domínio. A implementação inicial deve centralizar helpers de domínio e ter testes que detectem caminhos sem incremento. Não depender apenas do update genérico.
6. Exclusão/desativação exige a versão apresentada na confirmação e proteção condicional. Excluir um registro recém-alterado deve gerar conflito; recursos já removidos devem ter resposta explícita e consistente.
7. Separar erros estruturados: `STALE_VERSION`, `RESOURCE_REMOVED`, `BUSINESS_CONFLICT`, `DUPLICATE_OPERATION`, `TEMPORARY_CONTENTION`. Manter HTTP 409 para conflito, 404 para ausência e 400/428 para precondição ausente conforme contrato documentado. Não tratar todo 409 como conflito de edição.

Entrega: backend e adaptadores com contrato único, todas as edições humanas vinculadas à versão original, testes cobrindo os caminhos de gravação. Arquivos principais: schema/migrações, relational-data-service, operations, api-adapter, repositórios, tipos e rotas.

## Fase 2 — Formulários e resolução de conflito

1. Rascunho em memória com estado inicial, versão inicial e campos realmente alterados; enviar PATCH apenas desses campos. Revisar mappers para campos ausentes não virarem zero, vazio ou null; diferenciar omitir de limpar explicitamente.
2. Não atualizar o rascunho enquanto o usuário digita. Se houver mudança externa, mostrar aviso e manter as entradas. Se não houve alteração local, permitir atualizar o formulário automaticamente.
3. Ao detectar defasagem, manter o formulário aberto e oferecer ver os dados atuais e revisar a edição. Comparar original, rascunho e atual somente nos campos que o usuário pode ler; nunca incluir hashes de senha ou campos ocultos por permissão.
4. Primeira entrega usa revisão explícita: carregar estado atual como nova base e reaplicar somente as alterações escolhidas pelo usuário, submetendo com a nova versão. Uma terceira mudança durante essa revisão ainda pode produzir novo conflito.
5. Não oferecer botão genérico de forçar gravação. Para dinheiro, estoque, ocupação e comanda, exigir revalidação pelo fluxo de negócio; não fazer merge automático de listas de itens, valores financeiros ou estados.
6. Tratar resposta perdida: se o servidor confirmou a gravação mas o refresh falhou, mostrar que foi salva e que falta atualizar a tela. Não induzir uma segunda operação.
7. Padronizar erros e estado de envio nas telas; impedir duplo clique sem considerar isso a proteção principal. Não persistir rascunhos sensíveis no navegador nesta fase.

Entrega: componente reutilizável de conflito e adoção nos módulos, com testes de rascunho e atualização externa. Revisar reservas, quartos, hóspedes, mesas/comandas, produtos/estoque, receitas, funcionários, fornecedores, clientes, financeiro, usuários e configurações.

## Fase 3 — Operações críticas, retries e restrições

1. Preservar atomicidade de pagamento + título + saldo + caixa + auditoria + recibo. O servidor recalcula preços, saldo restante e disponibilidade usando o estado atual; nunca aceita saldo enviado pelo navegador como autoridade.
2. Propagar requestId estável em reenvios da mesma intenção. Payload alterado usa novo identificador e nova aprovação quando necessária. Expandir idempotência a criações/comandos ainda fora do executor, sem reutilizar a mesma chave para operações deliberadamente novas.
3. Retry de até três tentativas totais para falhas transitórias conhecidas, com espera curta e aleatória fora da transação. Nunca repetir automaticamente uma versão desatualizada, falta de permissão, saldo insuficiente ou regra de negócio. P2002 só é recuperável quando comprovadamente ligado à disputa pelo mesmo recibo; as outras unicidades têm erro direto.
4. Manter transações curtas; adquirir recursos em ordem estável nas operações de vários produtos/contas. Usar bloqueio de linha por poucos instantes apenas onde os testes evidenciarem necessidade, com limite de espera. Nenhum lock atravessa o tempo em que o usuário edita uma tela.
5. Conferir índices/restrições existentes e acrescentar os faltantes: uma sessão de caixa aberta, uma comanda ativa por mesa, identificadores únicos e consistência de valores. Para reservas, validar intervalos e considerar restrição de exclusão por quarto/período e estados ativos após conferir os dados existentes. A disponibilidade inclui manutenção e hospedagem; a restrição isoladamente não substitui essas regras.
6. Conferir cancelamento/estorno/recebimento simultâneos. Dois requestIds diferentes são duas intenções: se houver risco de dois pagamentos parciais com valor igual serem aceitos por engano, exigir estado/versão esperada ou identificador único da cobrança, sem deduplicar pagamentos legítimos apenas por valor e horário.
7. Importação/restauração deve ser operação administrativa explícita, em modo de manutenção que impeça escritas conflitantes. Scripts internos e seed seguem escopo próprio; não transformar o acesso operacional em um bypass de versões.
8. Medir o impacto de `evaluateStock/evaluateTimed` executados globalmente a cada operação. Reduzir avaliações aos recursos afetados e deixar verificações periódicas com o worker existente, preservando eventos transacionais relevantes.

Entrega: invariantes de negócio verificadas sob concorrência; retries e idempotência centralizados; migrações pequenas e auditáveis.

## Fase 4 — Atualização rápida entre dispositivos

Implementar SSE no próprio servidor Next.js, mantendo a atualização de 15 segundos como recuperação. SSE é suficiente porque o navegador só precisa receber avisos de mudança; gravações continuam pelas APIs atuais. Não acrescentar servidor WebSocket ou mensageria externa.

- PostgreSQL envia avisos mínimos por `LISTEN/NOTIFY`; dentro da transação, só são entregues após commit. Usar triggers por instrução nas tabelas pertinentes, com mapeamento explícito para módulos, incluindo filhos e writes do worker. Referência: [NOTIFY no PostgreSQL 16](https://www.postgresql.org/docs/16/sql-notify.html).
- Uma conexão PostgreSQL dedicada de escuta por processo web; não uma por navegador e não uma transação Prisma mantida aberta. Reconectar com espera crescente, heartbeat e limpeza ao desconectar. Validar APIs de streaming no Next.js instalado antes da implementação.
- `/api/sync/events` autentica sessão e filtra os módulos autorizados; revalida expiração/desativação/permissões durante conexões longas. Não enviar hóspedes, valores, senhas ou dados de registros pelo canal. PostgreSQL NOTIFY é visível a usuários do banco; payload deve ser apenas um aviso técnico sem conteúdo sensível.
- Eventos invalidam módulos e recarregam dados pelas APIs autorizadas. Agrupar avisos próximos para evitar vários refreshes por operação; descartar respostas antigas por geração e manter apenas uma busca concorrente por grupo.
- Rascunhos permanecem intactos. Ao reconectar, fazer refresh completo dos módulos autorizados: NOTIFY não é histórico durável e eventos podem ser perdidos durante desconexão. Não usar IDs de sequência como garantia de ordem de commit sem um desenho adicional.
- Manter polling/foco como fallback e indicar conexão interrompida. Na volta do celular do segundo plano, atualizar sessão e dados. Testar buffering/timeouts em Docker, proxy e Tailscale Serve.
- Meta de homologação: alteração aparecer em até dois segundos numa conexão estável, sem promessa de disponibilidade ou latência absoluta. Se SSE não estiver disponível, manter os 15 segundos; integridade permanece protegida.
- SSE fica atrás de configuração que permita desativá-lo sem afetar gravações. Em futura execução de múltiplos processos, cada processo pode escutar PostgreSQL; o estado em memória não será autoridade do banco.

Entrega: sincronização rápida sem novo serviço Docker, com reconexão/fallback testados e orientação de operação.

## Fase 5 — Testes, observabilidade e entrada em produção

Testes de integração usam exclusivamente `erp_test`, sessões distintas e barreiras controladas para forçar concorrência; não apenas duas chamadas que podem acabar sequenciais. Conferir o estado final, não só códigos de resposta.

| Cenário | Resultado obrigatório |
| --- | --- |
| Duas edições com a mesma versão | Uma salva; outra recebe conflito e preserva seu rascunho |
| Refresh enquanto formulário está aberto | A versão original permanece; nenhum campo digitado some |
| Edição e exclusão concorrentes | Não excluir silenciosamente o registro atualizado |
| Venda do último item por dois usuários | Uma venda aceita, estoque nunca negativo e nenhuma receita órfã |
| Reservas/check-ins sobrepostos | Uma ocupação válida, sem períodos incompatíveis |
| Recebimento duplicado com mesmo requestId | Um único efeito financeiro e o mesmo resultado nos reenvios |
| Recebimento/estorno com requestIds diferentes | Estado final compatível com saldo/versão e regras de pagamento |
| Fechar/editar/cancelar a mesma comanda | Estado consistente, uma cobrança válida, sem itens perdidos |
| Duas aberturas/fechamentos de caixa | Respeitar unicidade e não duplicar o fechamento |
| Falha após commit/antes da resposta | Reenvio recupera o recibo; não duplica o efeito |
| Rollback + SSE | Nenhum aviso de sucesso de alteração desfeita |
| Worker, SSE desconectado, reinício web/banco | Reconnect/refresh recupera dados corretos |
| Usuário sem acesso, sessão revogada | Nenhum dado ou aviso de módulo proibido |

Adicionar logs estruturados de versão desatualizada, retry, espera e reconexão com IDs técnicos e duração, sem payloads pessoais. Usar os logs Docker existentes; não exigir plataforma de monitoramento nova. Separar conflitos normais de edição de erros inesperados. Registrar alterações bem-sucedidas na auditoria atual e falhas nos logs operacionais.

Antes de publicar: backup e restauração verificados, migrações no teste e demo, build/typecheck/lint e testes unitários/integração pertinentes, teste em PC e celular com duas contas. Fazer teste de carga pequeno (por exemplo, 10 sessões ativas) na máquina-alvo para medir CPU, memória, conexões e latência; esse número é cenário de teste, não capacidade garantida.

Aplicação e banco devem ser atualizados de forma coordenada: o contrato obrigatório de versão pode exigir recarregar navegadores antigos. Evitar mudar tipos e APIs sem atualizar os consumidores. Migrações inicialmente aditivas; rollback da aplicação só é permitido enquanto o contrato e schema forem compatíveis. Não remover versões/recibos para voltar uma release.

## Ordem e conclusão

Executar fases 1–3 primeiro, integrando os formulários a cada contrato de backend para não deixar uma release intermediária inutilizável. Elas fornecem a proteção fundamental. Fase 4 melhora a atualização, sem ser requisito para validar integridade. Fase 5 acompanha todas as etapas e encerra a homologação.

Considerar concluído quando não houver caminho operacional de gravação sem classificação/proteção, rascunhos sobreviverem aos conflitos, invariantes passarem nos testes reais de concorrência e a instalação puder operar com SSE desativado. Manter um único PostgreSQL e servidor web; não presumir que o tamanho dos ERPs de referência exige copiar sua infraestrutura.
