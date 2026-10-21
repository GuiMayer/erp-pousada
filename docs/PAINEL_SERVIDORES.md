# Painel de servidores no Windows

Abra **ERP Pousada - Servidores** na área de trabalho. Para carregar mudanças do painel, feche a janela anterior e abra novamente o mesmo atalho. Não é necessário reconstruir o aplicativo para atualizar este painel.

Se precisar recriar o atalho, execute `scripts/install-server-panel.ps1` na pasta do projeto.

## Sistema normal e demonstração

Cada ambiente tem um cartão com estado local, idade da verificação, acesso privado e progresso da operação. **Iniciar** usa a instalação existente; **Encerrar** preserva os dados operacionais. Na demonstração, encerrar descarta os dados fictícios e o próximo início restaura os exemplos.

Em **Mais opções** da demonstração:

- **Restaurar exemplos:** inicia uma nova sessão usando a imagem instalada. Descarta as alterações fictícias.
- **Atualizar versão:** constrói a imagem com o código local e inicia uma nova sessão. Pode levar minutos. Uma construção que falha preserva a sessão anterior.

Iniciar uma demonstração que já está ligada preserva sua sessão. Construção automática ocorre apenas se não existir imagem. O banco operacional não é alvo dessas opções.

## Links e infraestrutura

O início confirma primeiro aplicativo e banco locais, depois prepara automaticamente o acesso pelo Tailscale. Se somente a rede falhar, o cartão mantém **Pronto localmente** e informa que o acesso remoto está pendente. Use **Preparar link** para repetir essa etapa.

**Abrir site** e **Copiar link** continuam disponíveis durante outras operações quando há endereço conhecido. Um endereço conhecido não garante disponibilidade: observe também a situação do acesso e a idade da verificação.

O Tailscale continua sendo uma opção externa de instalação. O painel usa acesso privado via Serve, recusa Funnel e preserva outros encaminhamentos. O dispositivo do visitante precisa de acesso autorizado à rede Tailscale.

Consultar o estado não cria o processo de permanência do WSL nem inicia uma distribuição parada. Use **Iniciar Docker** quando necessário. A inicialização explícita de um servidor pode iniciar o WSL configurado para o Docker. Docker Desktop e Tailscale têm botões de abertura quando instalados.

## Backups e diagnóstico

**Pasta de backup** configura a segunda cópia em pasta local, inclusive uma pasta sincronizada pelo Drive. **Fazer backup** verifica as cópias configuradas. A sincronização externa deve ser conferida no aplicativo responsável.

**Mostrar diagnóstico** apresenta tempos, quantidade de comandos e falhas por componente. **Abrir histórico** mostra os registros locais em `.local/server-panel`; são mantidas até 30 operações, além da última operação e do último erro. Não são registrados argumentos de comandos nem stderr bruto, pois podem conter credenciais.

As consultas de Docker, Tailscale e backup são independentes. Há até três execuções de monitoramento simultâneas e apenas uma operação de alteração. Os intervalos são 20 segundos para Docker/saúde local e 30 segundos para rede/backup/acesso; durante operações, consultas locais passam a dois segundos. Minimizado, o painel reduz a frequência para 60 segundos. Falhas de consulta usam recuo de até 120 segundos. Os intervalos contam a partir da conclusão e não são promessa de disponibilidade imediata.

**Verificar agora** invalida os resultados anteriores e solicita nova leitura. Resultados anteriores a uma operação não podem sobrescrever seu estado confirmado. Leituras lentas não bloqueiam os botões de comando.

## Cancelar e fechar

**Cancelar espera** interrompe a espera cooperativamente. Não desfaz comandos que o Docker já recebeu; o painel consulta o estado real em seguida. Nunca encerra o Docker inteiro nem apaga volumes do banco operacional.

Fechar o painel mantém servidores ligados. Se houver operação em andamento, a janela explica que ela continuará e pede confirmação antes de fechar. O resultado será salvo no histórico pelo executor.

## Validação

Os testes Windows usam processos de teste e serviços simulados; não precisam iniciar Docker ou WSL:

```powershell
.\scripts\test-server-panel.ps1
.\scripts\test-server-panel-monitor.ps1
.\scripts\test-docker-runtime.ps1
.\scripts\server-panel.ps1 -SelfTest
```

O último comando exercita a interface com dados fictícios e gera prévias locais. A validação com servidores reais e escalas de tela de 125%/150% continua necessária no computador da instalação. Construção de imagem e inicialização do PostgreSQL continuam tendo custos reais; o painel evita repetições desnecessárias e mostra as etapas, sem prometer concluir essas tarefas em poucos segundos.
