# Concorrência e sincronização

Implementação de 08/10/2026. O PostgreSQL permanece a autoridade das gravações. A atualização rápida ajuda os usuários a acompanhar alterações, mas a integridade não depende dela.

## Comportamento para o usuário

- Formulários enviam a versão originalmente apresentada. Atualizações da lista não autorizam sobrescrever uma edição feita em outro dispositivo.
- Ao salvar um cadastro desatualizado, a aplicação preserva o rascunho e mostra os dados atuais. Nos cadastros simples, o usuário escolhe quais campos reaplicar. Uma nova alteração externa pode exigir outra revisão.
- Valores financeiros, estoque, receitas, orçamentos e permissões exigem revisão no formulário e nova abertura com dados atuais. Não há gravação forçada nem combinação automática desses valores.
- Exclusões usam a versão do registro apresentado na confirmação. Um registro alterado ou removido gera uma resposta explícita.
- Recebimentos de hospedagem, contas a receber e pagamento de despesas enviam a versão do título. Duas intenções com identificadores diferentes, abertas sobre a mesma versão, não confirmam dois pagamentos parciais inadvertidamente.
- Reenvios de operações conservam o identificador da intenção para recuperar o recibo. Criações de cadastro também usam esse mecanismo. Uma operação deliberadamente nova recebe outro identificador.

Os rascunhos ficam em memória. Fechar ou recarregar a página pode descartá-los. Em dispositivos diferentes, cada pessoa deve usar sua própria conta.

## Contratos e proteção no banco

| Caminho | Proteção |
| --- | --- |
| PATCH de cadastro | Versão explícita, atualização condicional, transação e auditoria |
| DELETE de cadastro | `If-Match` numérico com a versão da confirmação |
| POST de cadastro | `Idempotency-Key` UUID e recibo no executor |
| Reserva e comanda editadas | Versão do agregado e revalidação de regras |
| Recebimentos e despesas | Versão do título na API, saldo recalculado e operação atômica |
| Estoque, caixa e ocupação | Regras transacionais existentes, escritas condicionais e restrições |
| Importação e limpeza administrativas | Bloqueio exclusivo de manutenção e encerramento das sessões |
| Worker e outros fluxos internos | Triggers atualizam versões e publicam avisos após commit |

`recordVersion` é um token de concorrência; `restaurant_orders.version` protege a comanda. O incremento pode ser maior que um quando uma operação altera filhos do agregado. Não interprete esses tokens como uma contagem de edições humanas. A versão funcional da receita continua independente.

A migração `20261008000200_concurrency_sync` instala triggers de versão, atualização dos pais quando seus filhos mudam, avisos de sincronização e proteção compartilhada de manutenção. Também assegura uma comanda aberta por mesa com índice único. As restrições existentes de caixa e as verificações de sobreposição de reservas em transações Serializable continuam em vigor.

Erros de API:

| Código | HTTP | Ação esperada |
| --- | --- | --- |
| `VERSION_REQUIRED` | 428 | Recarregar a aplicação e reabrir o formulário |
| `STALE_VERSION` | 409 | Revisar dados atuais, preservando o rascunho |
| `RESOURCE_REMOVED` | 404 | Informar que o registro não existe mais |
| `BUSINESS_CONFLICT` | 409 | Corrigir a condição de negócio indicada |
| `TEMPORARY_CONTENTION` | 409 | Contenção após esgotar as tentativas; revisar antes de reenviar |

O executor repete somente falhas transitórias de serialização, até três tentativas totais, com espera curta e aleatória fora da transação. Uma violação de unicidade só recupera um resultado quando existe o recibo correspondente. Versões desatualizadas, permissões e regras de negócio não são repetidas automaticamente.

As avaliações de alertas no executor foram limitadas aos tipos de operação que afetam estoque, reservas, comandas e recebimentos. O worker existente continua a reconciliação completa a cada 30 segundos. Não foi acrescentado outro serviço.

## Atualização entre dispositivos

O navegador abre `/api/sync/events` por SSE. O servidor mantém uma conexão PostgreSQL de `LISTEN` por processo web e distribui avisos mínimos: apenas o nome da coleção, sem dados pessoais ou financeiros.

Os avisos são entregues após commit. O servidor filtra as coleções pelas permissões e revalida a sessão a cada dez segundos. Cada fluxo dura até cinco minutos, com reconexão automática do navegador. Ao perder a conexão do banco, o servidor tenta restabelecê-la com espera crescente, até 30 segundos.

O cliente agrupa avisos por 200 ms e consulta as coleções alteradas pelas APIs autorizadas. Na reconexão, recarrega os dados autorizados: NOTIFY não guarda histórico. Continua consultando a cada 15 segundos enquanto a página está visível e ao recuperar o foco. Respostas de carregamentos superados são descartadas.

Para desativar apenas os avisos rápidos, configure `SYNC_EVENTS_ENABLED=false` em `.env.docker.local` e recrie o serviço web com os mesmos arquivos Compose usados na instalação. A atualização periódica e as proteções de gravação continuam funcionando. Na demonstração, a mesma variável pode ser definida no ambiente antes de iniciar o script.

Tailscale é uma opção de acesso particular da instalação, conforme o guia existente. A conexão SSE usa o mesmo endereço do site e não precisa de uma porta pública adicional.

## Atualização e operação

1. Faça e verifique o backup conforme [guia de produção](PRODUCAO.md). Combine uma janela sem usuários realizando operações.
2. Atualize código, imagem web e migração juntos, usando o procedimento Docker existente. Não aplique a migração em uma versão antiga do aplicativo que ainda não envia os tokens obrigatórios.
3. Reabra ou recarregue os navegadores depois da atualização. Formulários de uma sessão anterior precisam ser abertos novamente.
4. Verifique saúde dos serviços e teste com duas contas antes de liberar o uso.

Não remova versões, triggers ou recibos para contornar conflitos. Restauração externa por `pg_restore` deve ser feita com aplicação e worker interrompidos; o bloqueio do fluxo administrativo não substitui esse procedimento de recuperação.

Os logs Docker incluem `concurrency.stale`, `concurrency.retry`, `sync.connected`, `sync.disconnected` e `sync.retry`, sem payloads dos registros. A auditoria existente continua registrando alterações confirmadas.

## Validação e limites

Testes reais usam exclusivamente `erp_test`: duas sessões editando a mesma versão, exclusão desatualizada, campos omitidos preservados, versões alteradas por domínio, criação idempotente, recebimentos parciais concorrentes, avisos após commit, rollback sem aviso, manutenção bloqueando escritas, autenticação e filtragem SSE. Dez leitores SSE compartilham uma conexão de escuta; o teste também interrompe essa conexão e verifica reconexão e encerramento de sessão expirada.

A demonstração isolada serve para homologar a interface em `localhost:3001`, sem modificar o banco principal. O teste visual em duas abas verificou comparação de conflitos e retorno ao rascunho preservado.

Esse cenário não é um teste de capacidade nem uma garantia de latência. A homologação final com celular, Tailscale, proxy, recursos da máquina da pousada e procedimento de backup/restauração deve ser feita nessa instalação. Uma restrição de exclusão por intervalo de reserva e avaliações de alertas por registro individual permanecem melhorias futuras condicionadas a dados e medições; as regras transacionais atuais foram preservadas.
