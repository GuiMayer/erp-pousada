# Notificações operacionais

A central usa PostgreSQL no modo operacional. Eventos, destinatários, leitura, arquivo e preferências persistem após reinícios e fazem parte do backup. O modo de demonstração tem armazenamento separado por usuário; históricos antigos do navegador não são importados.

## Uso

O sino reúne eventos e alertas. As abas permitem ver todas, alertas e arquivadas. “Ler esta página” atua somente sobre as mensagens carregadas, sem alcançar notificações novas. Arquivar afeta apenas sua caixa; é possível restaurar durante a retenção. “Abrir módulo” leva ao setor autorizado, onde os detalhes podem ser consultados.

A caixa atualiza a cada 15 segundos enquanto a página estiver visível, ao retornar ao foco e depois de operações locais. Em falhas de rede, informa o erro e espaça tentativas até dois minutos. O histórico carrega páginas de 30 mensagens por data e identificador.

Cada usuário recebe apenas eventos dos módulos cujas permissões de leitura possuía na criação. A consulta revalida os acessos atuais: revogar acesso oculta mensagens e contadores; concedê-lo não libera histórico anterior. A aprovação temporária de uma ação não concede acesso ao histórico.

O restaurante está arquivado: eventos antigos de comandas e produção são excluídos da lista e do contador de não lidos. As rotinas ativas não avaliam duração de comandas nem estoque de produtos classificados como restaurante.

## Eventos e condições

Reservas individuais/grupos, alterações, descontos, cancelamentos, check-in/out, liberação/bloqueio de quarto, consumo/recebimento, venda/estorno e fechamento de caixa geram eventos dentro da mesma transação das operações. Reenvios do mesmo pedido não duplicam eventos e rollback não deixa aviso de sucesso.

Estoque baixo/crítico nasce em movimentos confirmados e é reavaliado pelo worker; reposição resolve a ocorrência. Agravamento gera nova ocorrência e encerra a anterior. Uma nova queda após recuperação cria outro alerta.

O worker avalia entradas previstas a partir do horário de check-in, saídas e saldo de hospedagem a partir do horário de check-out, títulos após o dia de vencimento. Usa America/Sao_Paulo. Fechamentos com divergência geram avisos conforme os limites globais da Administração. Condições resolvem com as operações correspondentes. Alertas críticos de caixa exigem conferência de usuário com `approvals.issue`; a resolução é auditada. Alertas de estoque não podem ser resolvidos manualmente.

Preferências pessoais em Configurações controlam avisos comuns por categoria. Alertas críticos ativos continuam visíveis e não podem ser arquivados. Marcar como lido não resolve a condição. As opções globais e limites da Administração dirigem as regras automáticas e não são substituídos por preferências pessoais.

## Avisos do navegador

São opcionais, genéricos e dependem da permissão de cada navegador. Funcionam enquanto o aplicativo estiver aberto e puder atualizar a caixa; não há push com o aplicativo fechado. A primeira atualização após login não reenvia o histórico. IDs apresentados são deduplicados por usuário/dispositivo; navegadores com Web Locks coordenam abas. Falhas da API nativa não alteram operações confirmadas.

## Docker e manutenção

O serviço `notification-worker` executa a cada 30 segundos, com exclusão mútua transacional no PostgreSQL. Não depende de navegador, Redis, WebSocket ou Tailscale. O acesso via Tailscale segue opcional e externo ao aplicativo.

`setup-docker.ps1` gera `DB_WORKER_PASSWORD`; `start-docker.ps1` acrescenta essa credencial automaticamente em instalações antigas, preservando as demais. Quem usa Compose diretamente precisa acrescentar uma senha aleatória de 48 caracteres hexadecimais em `.env.docker.local` antes da atualização. Não compartilhe nem versione esse arquivo.

O worker usa `pousada_notifications`, sem privilégio de alterar estoque, finanças, usuários, schema ou conteúdo de eventos. A aplicação também não pode editar o conteúdo nem excluir eventos; pode apenas atualizar a resolução. O worker mantém `notification_worker_state` com último sucesso/erro e uma verificação de saúde própria. `docker compose --env-file .env.docker.local ps` mostra seu estado e `logs notification-worker` ajuda no diagnóstico.

A limpeza remove em lotes de até 500 o histórico com mais de 30 dias, preservando alertas críticos ainda ativos. A auditoria tem retenção independente. Para atualizar, execute o procedimento normal do guia de instalação: migração, concessões e início do app/worker. Faça backup antes e valide a restauração em banco separado.
