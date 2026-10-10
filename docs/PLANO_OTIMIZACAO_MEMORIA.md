# Plano de otimização de memória do Docker

Inspeção: 8 de outubro de 2026. Este documento propõe mudanças; a configuração operacional não foi alterada nesta inspeção.

## Diagnóstico medido

- Computador com aproximadamente 32 GB de RAM e 12 processadores lógicos; cerca de 2,6 GB de memória física livre no momento da consulta.
- Docker Desktop 29.4.1 usando WSL 2.6.3. A máquina Linux enxerga aproximadamente 15,5 GiB de RAM e 4 GiB de swap.
- Processo `vmmemWSL`: aproximadamente 7,4 GiB residentes no Windows.
- Todos os 14 contêineres estavam parados. Portanto, não foi possível medir o consumo por serviço sob carga sem iniciar os servidores.
- Dentro do WSL, `free` mostrou aproximadamente 1,9 GiB usados, 12,1 GiB de buffers/cache e 13,3 GiB disponíveis. Esses números têm definições diferentes do conjunto residente apresentado pelo Windows e não devem ser somados ou subtraídos diretamente.
- O consumo observado é compatível com memória/cache retidos após trabalho anterior, inclusive construção de imagens; não demonstra vazamento da aplicação.
- Não existe `C:\Users\usuario\.wslconfig`. Não há limites personalizados de RAM/CPU/swap no arquivo persistido do Docker consultado. O limite observado é compatível com o padrão de 50% da RAM do Windows. A ausência de configuração explícita não significa que a recuperação automática esteja desabilitada: a documentação atual informa `dropCache` como padrão.
- Nenhum contêiner tem limite ou reserva de RAM/CPU configurados. Não houve indicação `OOMKilled` nos contêineres inspecionados; códigos de saída 137 isoladamente não provam falta de memória.
- Normal e demonstração possuem servidores, bancos e trabalhadores separados. Essa separação protege os dados e será preservada.
- O aplicativo já roda em modo de produção. A imagem final contém Next, dependências de produção, Prisma CLI, `tsx`, scripts e migrações. Aplicativo e notificações usam iniciadores que podem acrescentar processos ao Node.
- A conexão Prisma usa o adaptador PostgreSQL sem um tamanho de pool definido explicitamente por função.
- Há aproximadamente 21,7 GB de cache de construção e 23,5 GB de imagens em disco. Isso é armazenamento, não RAM consumida continuamente.
- O Docker está configurado com `AutoStart: false`, relevante para disponibilidade após reiniciar o computador, mas independente desta otimização.

## 1. Controlar a memória do WSL e recuperar cache

Configurar explicitamente um perfil inicial de operação em `.wslconfig`:

```ini
[wsl2]
memory=4GB
processors=4
swap=2GB

[experimental]
autoMemoryReclaim=dropCache
```

- Usar 4 GB inicialmente para o servidor normal; usar 6 GB quando ambos os ambientes precisarem funcionar simultaneamente.
- Não desabilitar swap: manter margem para picos, acompanhando paginação para que não substitua RAM continuamente.
- Aplicar a mudança em janela de manutenção, com desligamento organizado dos serviços e reinício do Docker/WSL. A configuração afeta todo o WSL 2 do usuário, não apenas este repositório.
- Verificar a recuperação de memória após construção e após parar os serviços. A opção explícita torna o perfil reproduzível; não garante que um comportamento já padrão passará a funcionar sem validar.
- Habilitar/verificar o Resource Saver, sem depender dele para liberar RAM: no backend WSL, a documentação diferencia sua economia de CPU da recuperação de memória feita pelo WSL.
- No painel, oferecer uma ação separada para encerrar o Docker quando todos os serviços estiverem parados, verificando outros contêineres antes. Não encerrar automaticamente o Docker ao parar um ambiente.
- Não usar tarefas periódicas para forçar descarte de cache ou reiniciar o Docker em produção.

## 2. Definir orçamento por serviço

Valores iniciais para teste, não consumo esperado ou valores já homologados:

| Serviço | Limite inicial | Reserva indicativa | Heap Node inicial |
| --- | ---: | ---: | ---: |
| Aplicativo normal | 1.024 MiB | 256 MiB | 512 MiB |
| PostgreSQL normal | 768 MiB | 128 MiB | — |
| Notificações normal | 384 MiB | 96 MiB | 128 MiB |
| Backup normal | 512 MiB | 64 MiB | — |
| Proxy normal | 128 MiB | 32 MiB | — |
| Aplicativo demo | 1.024 MiB | 256 MiB | 512 MiB |
| PostgreSQL demo | 512 MiB | 128 MiB | — |
| Notificações demo | 384 MiB | 96 MiB | 128 MiB |

- Aplicar `mem_limit` e `mem_reservation` no Compose e verificar os valores efetivos com inspeção do Docker. Reserva é uma indicação para pressão de memória; não significa RAM dedicada antecipadamente.
- O teto somado dos serviços contínuos normais é aproximadamente 2,75 GiB; com demo, aproximadamente 4,63 GiB. A máquina virtual também precisa de memória própria, por isso o perfil simultâneo propõe 6 GB.
- Limitar separadamente tarefas temporárias de migração/semente: começar com 1.024 MiB e executá-las em sequência. Restauração deve ter perfil de manutenção com margem própria.
- Aplicar `NODE_OPTIONS` apenas aos processos de execução correspondentes; limite de heap não é limite da memória total do Node. Preservar margem para buffers, bibliotecas nativas e verificações de saúde.
- Não limitar CPU agressivamente no primeiro passo. Medir antes de introduzir quotas que prejudiquem resposta, backup e processamento de notificações.
- O tmpfs de 256 MiB da demo é um teto, não alocação fixa; seu uso real também precisa caber no orçamento do banco.

## 3. Ajustar PostgreSQL e pools de conexão

- Começar com `shared_buffers=64MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `autovacuum_work_mem=32MB` e `max_connections=40` no servidor normal; validar também a demo.
- Definir pool explícito: aplicativo até 8 conexões, notificações até 2; timeouts de conexão e de ociosidade configuráveis. Somar processos reais e conexões temporárias de backup, migração e administração antes de reduzir o teto do banco.
- Manter autovacuum, WAL, sincronização e garantias transacionais. Não trocar consistência ou durabilidade por economia de memória.
- Verificar consultas de relatórios, operações concorrentes, eventos de sincronização e indisponibilidade temporária do banco. `work_mem` pode ser usado por várias operações de uma consulta e por várias sessões simultaneamente.
- Usar parâmetros de inicialização do PostgreSQL/configuração versionada, sem editar dados do volume. Fazer backup verificado antes de recriar serviços.
- Evitar PgBouncer neste porte: primeiro ajustar o pool existente e medir; não adicionar outro serviço sem necessidade comprovada.

## 4. Enxugar execução e separar construção de operação

- Executar diretamente o processo Node do aplicativo, removendo o iniciador `pnpm` em execução contínua.
- Compilar notificações para JavaScript e executar Node diretamente, eliminando transformação TypeScript e processos auxiliares em produção.
- Avaliar imagem Next `standalone`, copiando os arquivos estáticos/públicos necessários. Usar estágios/imagens próprios para migração e semente, sem carregar suas ferramentas no aplicativo contínuo.
- Não confundir imagem menor com redução equivalente de RAM: validar memória residente, inicialização, acesso ao banco, relatórios e compatibilidade dos arquivos incluídos pelo Next.
- Construir atualizações preferencialmente no CI e baixar imagens versionadas no computador da pousada. Ajustar a distribuição das imagens junto da estratégia de versões/rollback já existente.
- Se a construção ocorrer aqui, fazê-la separadamente por ambiente, sem builds paralelos; usar temporariamente perfil de 8 GB caso a medição indique necessidade. Após a construção, voltar ao perfil de operação em manutenção programada.
- Executar migrações em sequência e impedir duas construções concorrentes no painel. `NoBuild` deve continuar usando uma imagem compatível e já preparada.
- Não unir normal e demo, nem remover os trabalhadores de backup/notificações para economizar processos.

## 5. Melhorar diagnóstico e uso dos ambientes no painel

- Mostrar RAM do WSL separadamente do consumo dos contêineres e indicar quando há cache recuperável.
- Mostrar ambientes ativos, limites de memória e sinais de reinício/OOM. Coletar por demanda ou em intervalo moderado, sem adicionar um serviço permanente de monitoramento.
- Avisar quando normal e demo estão ligados juntos; não desligar automaticamente produção quando o usuário inicia demo.
- Continuar iniciando apenas o ambiente solicitado e encerrando todos os serviços dele de forma organizada. Corrigir encerramento demorado de notificações com espera interrompível, preservando desconexão do banco.
- Oferecer limpeza opcional de cache de construção antigo como ação de armazenamento, explicando que a próxima construção poderá ser mais lenta. Nunca incluir volumes de bancos em limpeza genérica.

## 6. Validar e reduzir progressivamente

1. Registrar linha de base com normal ligado, depois demo isolada e ambos juntos. Medir em repouso e durante uso, sem presumir os valores a partir desta inspeção com serviços parados.
2. Repetir a medição após cada etapa: memória residente do Windows/WSL, memória e CPU por contêiner, swap, reinícios e erros.
3. Exercitar login, reservas, pagamentos, estoque, relatórios, notificações, sincronização de múltiplos usuários e backup com segunda cópia. Restaurar o backup em banco isolado.
4. Fazer teste com 5–10 sessões simultâneas e executar backup durante o uso. Rodar ao menos uma hora de teste e observar um dia de uso real antes de reduzir mais os limites.
5. Critérios: nenhum OOM/reinício por falta de memória, nenhum timeout novo, sem crescimento contínuo em repouso, sem paginação sustentada e sem regressão significativa no tempo de resposta em relação à linha de base.
6. Buscar menos de 3 GB de memória residente para operação normal e menos de 1 GB em repouso sem contêineres. São objetivos a validar, não garantias; ajustar para cima quando necessário.
7. Após estabilidade, testar perfil de 3 GB apenas para operação normal. Manter 4 GB se relatórios, backup ou carga não deixarem margem. Documentar resultados e configuração final no guia.

## Entrega e reversão

Ordem de implementação: linha de base → perfil WSL → limites dos serviços → banco/pools → execução/imagens → diagnóstico do painel → teste de carga e refinamento.

Preservar configuração anterior do WSL, arquivos Compose e referências das imagens. Em regressão, restaurar limites/configuração/imagem anterior, sem restaurar ou apagar dados do banco. Recriar apenas serviços afetados. Não houve alteração operacional nesta fase de planejamento.

## Referências oficiais

- [Microsoft: configuração do WSL](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Docker: backend WSL](https://docs.docker.com/desktop/features/wsl/)
- [Docker: Resource Saver e diferença no WSL](https://docs.docker.com/desktop/use-desktop/resource-saver/)
- [Docker Compose: limites e reservas dos serviços](https://docs.docker.com/reference/compose-file/services/)
- [PostgreSQL 16: consumo de recursos](https://www.postgresql.org/docs/16/runtime-config-resource.html)
- [Next.js: diagnóstico de memória](https://nextjs.org/docs/app/guides/memory-usage)
