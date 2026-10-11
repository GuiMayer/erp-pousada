# Análise e plano de melhoria do painel de servidores

Data: 11/10/2026. Base: `06ee119` (main). Escopo: painel Windows da área de trabalho; não é uma revisão da interface web do ERP. Este documento propõe melhorias; não altera o funcionamento do painel.

## Conclusão

O painel já usa um processo em segundo plano para operações demoradas. A lentidão percebida vem principalmente da fila única que mistura monitoramento com comandos, das consultas sequenciais e da reconstrução da demonstração em todo início. A interface fixa e os estados pouco específicos tornam essas esperas mais difíceis de compreender.

Recomendação: manter PowerShell e WinForms, separar consultas de comandos e organizar a tela por ambiente. Não há evidência que justifique adicionar Electron, um serviço web ou outra aplicação residente neste momento.

## Evidências e limites da análise

Foram lidos os scripts do painel, do executor, da rede, dos backups, do Docker e da demonstração, além dos testes existentes. A imagem de prévia salva em 08/10 foi inspecionada; não representa uma observação da janela em execução hoje.

Dois resultados de estado preservados em `.local/server-panel` indicam aproximadamente **35,7 s** e **30,8 s** entre a criação do arquivo de progresso e a gravação do resultado. Ambos terminaram com falha de comando e Docker indisponível. São indícios históricos baseados em horários de arquivos, não medições instrumentadas de cada etapa nem médias de funcionamento saudável.

Cinco inicializações de Windows PowerShell com `-NoProfile -NonInteractive -Command exit`, sem Docker/WSL, levaram **714, 457, 411, 412 e 420 ms**; mediana **420 ms**. Isso mede criação/encerramento de um processo vazio nesta máquina, não o custo completo de uma consulta do painel.

Docker e WSL não foram iniciados ou reiniciados nesta análise. Ainda falta medir tempos por etapa, consumo de CPU/memória e comportamento real da janela durante falhas e operações longas.

## Problemas encontrados

| Prioridade | Evidência no código | Efeito para o usuário |
| --- | --- | --- |
| Alta | `server-panel.ps1:41`: uma única variável `job` controla consultas e ações; um clique durante `Status` fica pendente até a consulta terminar. | O botão parece não responder, embora a janela continue recebendo eventos. |
| Alta | `server-panel-worker.ps1:57`: backup, Tailscale, Docker e os dois ambientes são consultados sequencialmente; a UI recebe o resultado agregado ao final. | Uma dependência lenta atrasa a apresentação de todos os estados. |
| Alta | `server-panel-worker.ps1:125` chama `start-demo.ps1` sem `-NoBuild`; este faz `down --volumes`, build e recriação. | Iniciar pode levar minutos e também descartar uma sessão já aberta. |
| Alta | `docker-runtime.ps1:17`: toda chamada Docker passa pelo keepalive; ele pode iniciar `wsl.exe ... sleep infinity`. | Apenas abrir o painel e consultar o estado pode acordar o WSL. |
| Alta | `server-panel-worker.ps1:113/126`: inicialização inclui obrigatoriamente configuração e teste HTTPS do Tailscale. | Servidor local funcionando pode aparecer como inicialização incompleta por uma falha de acesso remoto. |
| Média | `server-panel.ps1:194/211`: resultado de uma ação atualiza a mensagem, mas o estado depende de uma nova consulta completa. | A operação termina e o cartão ainda aparenta estar iniciando. |
| Média | Botões principais são bloqueados em conjunto e reativados sem considerar o estado real. A seleção de pasta recusa até uma consulta de rotina. | Tarefas sem conflito ficam indisponíveis; “Iniciar” continua disponível quando já está ligado. |
| Média | `Get-State` faz um `docker ps` por ambiente; início normal faz um `inspect` por contêiner. Cada chamada WSL revalida keepalive via CIM. | Mais subprocessos e consultas do que o necessário. |
| Média | O caminho saudável de `Status` usa até cinco comandos externos: dois Tailscale e três Docker, mais até quatro testes HTTP. | Custos se acumulam em série; os timeouts HTTP de 3 s não são uma garantia rígida de duração total, especialmente envolvendo DNS. |
| Média | Atualização seguinte ocorre dez segundos depois do término da anterior; limite de espera de status é 90 s. | “Atualiza a cada dez segundos” não descreve o comportamento real. |
| Média | Janela fixa de 840 × 810, posições e alturas manuais; maximização desativada. | Pouca adaptação a telas menores, DPI e mensagens maiores. |
| Média | Erros de comando viram mensagem genérica; stdout/stderr são apagados. Falhas de backup no bloco de estado também podem acabar classificadas como Docker indisponível. | Diagnóstico perde a causa; o usuário recebe uma indicação potencialmente incorreta. |
| Média | Fechar a janela não define explicitamente o destino de uma operação em andamento; cancelar interrompe a espera, sem desfazer comandos enviados ao Docker. | Não fica claro se a operação continua e qual foi seu resultado efetivo. |

Arquivos citados estão em `scripts/`; as linhas se referem à versão analisada.

## Referências pesquisadas e aplicação ao projeto

1. **Manter a thread da interface livre.** A Microsoft orienta executar trabalho demorado fora dela e atualizar controles pelo mecanismo apropriado. O painel já segue parte dessa orientação. A melhoria necessária é não fazer uma consulta de rotina ocupar a fila de comandos. As APIs novas `InvokeAsync` de .NET 9 não devem ser copiadas para o Windows PowerShell atual. [Microsoft: chamadas entre threads em WinForms](https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/how-to-make-thread-safe-calls).
2. **Reutilizar execução de fundo com limites.** A documentação do PowerShell descreve pools de runspaces para reduzir o custo de criar contextos repetidos. Aplicação proposta: um executor reutilizável de monitoramento, com concorrência pequena, e um executor separado para mutações. A economia precisa ser medida no projeto. [Microsoft: criação de runspaces](https://learn.microsoft.com/en-us/powershell/scripting/developer/hosting/creating-multiple-runspaces?view=powershell-7.6).
3. **Consultar em lote.** Docker aceita múltiplos objetos no mesmo `inspect`. Uma listagem dos contêineres dos dois projetos e inspeção em lote substituem chamadas por ambiente/contêiner. [Docker: inspect](https://docs.docker.com/reference/cli/docker/inspect/).
4. **Mostrar progresso relacionado à ação.** Indicador indeterminado quando não há porcentagem confiável, com texto descrevendo a etapa. Não inventar “80%” durante build ou espera de saúde. [Microsoft: controles de progresso](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/progress-controls).
5. **Separar feedback imediato de conclusão.** A referência de usabilidade descreve aproximadamente 0,1 s para sensação de resposta imediata, 1 s para continuidade e 10 s como espera que exige atenção. Esses valores orientam o feedback, não prometem iniciar banco ou construir imagem nesse tempo. [Nielsen Norman Group: tempos de resposta](https://www.nngroup.com/articles/website-response-times/).
6. **Adaptar o layout ao conteúdo.** Usar contêineres de layout, AutoSize e dimensionamento flexível em vez de coordenadas fixas para cada componente. [Microsoft: TableLayoutPanel e AutoSize](https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/autosize-behavior-in-the-tablelayoutpanel-control).
7. **Tratar Tailscale como acesso complementar.** Seu estado de configuração pode ser lido como JSON; deve ter resultado e falha próprios. Manter acesso privado, sem Funnel, e preservar outros encaminhamentos. [Tailscale: Serve](https://tailscale.com/docs/reference/tailscale-cli/serve).

Docker também oferece eventos de início, parada e saúde. Eles podem reduzir polling, mas exigem reconexão e reconciliação de estado. Para dois ambientes, começar com consultas agrupadas e adaptativas é mais simples de manter; eventos ficam como evolução condicionada a medições. [Docker: events](https://docs.docker.com/reference/cli/docker/system/events/).

## Arquitetura proposta

Separar quatro responsabilidades, sem adicionar servidor ou banco ao painel:

- **Interface:** desenhar cartões, aceitar ações, mostrar progresso e consumir resultados. Sem rede, espera de processo ou diagnóstico pesado na thread visual.
- **Monitoramento:** consultas de leitura, reutilizáveis, com resultado parcial por dependência/ambiente, cache e prazo curto. Consultar não deve criar keepalive, iniciar Docker ou despertar uma distribuição parada; verificar primeiro sua disponibilidade por um mecanismo que não a inicialize.
- **Comandos:** uma mutação por vez inicialmente, preservando o mutex existente e todas as proteções do banco operacional. Monitoramento e ações locais como copiar link permanecem disponíveis. Ações incompatíveis ficam bloqueadas; nenhuma ação é silenciosamente perdida ou substituída.
- **Adaptadores:** Docker, Tailscale, HTTP e backups com resultados estruturados, prazos próprios e diagnóstico sanitizado. Keepalive somente no início explícito, com verificação reutilizada durante a operação.

Cada resultado deve conter componente/ambiente, estado, hora da observação, duração e erro identificado. Cada operação deve conter identificador, ação, argumentos completos, etapa, início e resultado. Descartar resultados de consultas antigas que chegarem depois de uma ação mais recente; não regredir um estado confirmado.

Estados locais: desconhecido, não instalado, desligado, iniciando, pronto, degradado e encerrando. Acesso remoto: não configurado, configurando, pronto e falha. Backup: não configurado, em execução, atualizado, atrasado e falha. Uma falha de rede não transforma um aplicativo saudável em “desligado”. Último estado conhecido deve ser marcado como desatualizado, não apresentado como confirmação atual.

## Plano na ordem de implementação

### 1. Instrumentação e separação entre leitura e comando

Registrar duração de cada etapa, tempo entre clique e feedback, tempo na fila, quantidade de subprocessos e resultado. Preservar histórico limitado e erros sanitizados, sem senhas, tokens, dumps de variáveis ou configuração completa de contêineres. Corrigir a classificação de falhas por componente.

Separar a fila de monitoramento da fila de mutações. Aceitar e indicar a ação imediatamente; não aguardar o ciclo de estado global. Interromper/suspender consultas conflitantes de forma limitada e evitar novos ciclos sobrepostos. Preservar argumentos e explicar a fila quando outra mutação estiver em andamento.

### 2. Redução do trabalho repetido

Agrupar consultas Docker, reutilizar contexto de execução e configuração. Publicar cada componente assim que estiver disponível. Fazer cache do Tailscale e backup, invalidado após ações relacionadas. Começar com intervalos configuráveis: aproximadamente 15–30 s em repouso, 1–2 s apenas para o ambiente em transição, e recuo progressivo em falha. Não criar novos subprocessos periodicamente com janela minimizada sem necessidade; manter informação de idade do estado.

Dar orçamento próprio e curto a cada consulta; o servidor indisponível não pode bloquear copiar link, abrir Docker/Tailscale ou consultar o outro ambiente. Validar o comportamento de DNS/HTTP no ambiente real, pois um timeout nominal isolado não garante o prazo global.

### 3. Tornar o início previsível

Separar “Iniciar demonstração” de “Atualizar versão” e “Restaurar exemplos”. Iniciar uma demonstração já pronta deve ser uma ação idempotente, sem apagar a sessão. Ao iniciar uma nova sessão, restaurar os exemplos conforme a política existente, usando a imagem instalada. Construir somente quando solicitado ou quando não existir uma imagem, com explicação prévia.

Publicar “Pronto localmente” assim que confirmado; continuar preparando o link automaticamente, com progresso separado. Se o Tailscale falhar, mostrar “Servidor pronto; acesso remoto pendente” e oferecer repetir somente essa etapa. Alterações de origem continuam autorizadas e verificadas; não recriar o app se a configuração já for a correta.

### 4. Redesenhar a interface

Dois cartões: **Sistema normal** e **Demonstração**. Cada um mostra estado curto, último horário confirmado, etapa em andamento e endereço. Ação principal muda entre Iniciar e Encerrar; Abrir e Copiar ficam próximos do link. Atualização/reinicialização e restauração ficam em ações secundárias, com aviso quando descartarem exemplos.

Infraestrutura e backup em área compacta; diagnóstico expansível com causa, duração e próximo passo. Janela redimensionável, layout automático e rolagem quando necessária. Usar texto e ícone junto das cores; navegação por teclado e ordem de foco previsível. Evitar mensagem global que mistura o resultado de duas operações diferentes.

### 5. Validar desempenho e comportamento sob falhas

Testar com adaptadores simulados antes de ligar infraestrutura real: Docker lento/ausente, WSL parado, Tailscale desconectado, HTTP sem resposta, backup em falha, cliques repetidos, resultado atrasado e fechamento durante operação. Não depender de contagem fixa de botões como prova de usabilidade.

Depois, validar no computador do usuário e em DPI 100%, 125% e 150%, inclusive 1366 × 768. Executar inicializações reais apenas em ocasião adequada, por causa do histórico de consumo de recursos.

## Critérios de aceite propostos

São metas de implementação, não resultados já alcançados:

- Feedback visual do clique até 100 ms; aceitação/identificação da operação até 1 s, sem depender da consulta passiva.
- Copiar um link conhecido continua imediato durante qualquer operação; abrir Docker/Tailscale não espera monitoramento.
- Estado parcial aparece sem aguardar a dependência mais lenta. Mudança confirmada por uma ação chega à tela no próximo ciclo visual, em até 1 s, sem consulta global intermediária.
- Consultas com Docker já disponível têm meta inicial de até 2 s para a informação local; medir percentil 95 em pelo menos 30 ciclos. Falhas respeitam orçamento próprio definido e deixam a janela utilizável.
- Abrir/minimizar/consultar o painel não inicia distribuição WSL parada. Em repouso, não há crescimento contínuo de processos, memória ou arquivos temporários.
- Iniciar demonstração já ativa não faz build nem descarta a sessão; restaurar exemplos afeta exclusivamente a demonstração.
- Desligar o ambiente normal preserva seus dados e backups. Falha no Tailscale não apaga nem mascara a disponibilidade local.
- Cancelar informa que interrompe a espera e reconcilia o estado real. Fechar o painel informa se uma operação continuará; fechar não desliga servidores já iniciados.
- Falhas têm componente e causa identificáveis no diagnóstico, com retenção limitada e sem segredos.

Prioridade: primeiro eliminar a espera da fila e as consultas com efeitos colaterais; depois reduzir trabalho e separar início/build; por fim reorganizar a apresentação e validar as metas. Melhorar somente as cores e os botões não resolve os gargalos encontrados.
