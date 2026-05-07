# Estratégia de Produção: Sistema Local para Pousada/Restaurante (Revisão Desktop)

Este plano detalha a arquitetura para levar o protótipo (Next.js) para produção em um ambiente **100% offline**, priorizando a **facilidade de instalação (1 clique)**, facilidade de uso (abrir como programa normal) e rotina de backups automáticos (horário/diário).

## 1. Arquitetura do Aplicativo: Desktop (Electron ou Tauri)
Para atender ao requisito de "instalar e abrir com 1 clique" sem usar linha de comando e garantir o funcionamento "offline first", o sistema será empacotado como um aplicativo nativo Desktop (`.exe`).

**Recomendação: Nextron (Next.js + Electron)**
- **Como funciona:** O código Next.js existente rodará encapsulado dentro do Electron. O cliente não precisa saber que é web. Ele recebe um `Instalador.exe`, clica "Avançar" e pronto: um ícone é gerado na Área de Trabalho.
- **Vantagem "Pronto para Uso":** O Electron já embute a própria versão do Node.js e o navegador (Chromium). A máquina do cliente não precisará instalar Node.js nem navegadores avulsos. Tudo abre com dois cliques, em tela cheia (estilo Kiosk/PDV).
- **Sem Internet:** O aplicativo executa totalmente offline isolado na máquina com seu próprio servidor interno e banco de dados local.

## 2. Estrutura do Banco de Dados offline (SQLite)
A mesma escolha, porém estruturada adequadamente para Aplicativos Desktop:
- **Banco de Dados:** **SQLite** em ambiente local com a estrutura controlada pelo Prisma ORM ou Drizzle.
- **Localização:** O arquivo SQLite *não deve* ficar na pasta de instalação, mas sim dentro de uma pasta segura do sistema operacional (ex: `%APPDATA%\PousadaApp\database.sqlite`). Dessa forma, atualizações do sistema não afetam os dados.

## 3. Estratégia de Atualização ("Facilmente Atualizável")
**Processo de Atualização Simples:** 
- Como os dados (`database.sqlite`) ficarão desacoplados dos arquivos do aplicativo (`%APPDATA%`), quando você for entregar uma atualização, bastará compilar a nova versão e o usuário reinstala no modelo: *"avançar, avançar e pronto"*. 
- O instalador irá sobrescrever apenas os binários, e quando o sistema abrir o novo código automaticamente se conectará ao `.sqlite` preservado. O Prisma roda as migrations automaticamente (atualizando as tabelas se necessário).

## 4. Estratégia Dupla de Backup (Horário Local / Diário Nuvem)
O sistema precisa de duas rotinas robustas implementadas:

1. **Backup Horário (Local):** 
   - Ao iniciar o aplicativo base no Electron, inicia-se um cron job (como o módulo `node-cron` que já rodará silenciosamente por trás).
   - A cada 1 hora ele faz uma cópia do `.sqlite` copiando-o para uma pasta como `C:\PousadaBackups\Backup_2026-04-07_14h00.sqlite`. O sistema pode manter o histórico de apenas as 48 últimas horas para não encher o disco.
2. **Backup Diário (Remoto/Nuvem):**
   - Agendamento de uma tarefa no fim do expediente (ex: 23:59h) que envia o arquivo `.sqlite` mais recente (ou um `.zip`) para a Nuvem de forma passiva (quando hover rede). 
   - Para isto, recomendarei instruir a pousada a baixar o "Google Drive Sync" (ou OneDrive) e mapear a *pasta principal* para que todo dia o arquivo atual seja clonado para o Drive sempre que for modificado.

## User Review Required

Com a visão "Desktop (Instalador Nativo) e Banco de Backup duplo" aprovada, você quer que comecemos com quais das tarefas no `v0-agi-pousada`?

1. **Iniciar a implementação do SQLite e Prisma** (Converter o protótipo/mocks de dados para acessar o arquivo local real).
2. **Setup do App Wrapper e Instalador/Electron** (Configurar o script de Build para gerar um executável `.exe`).
3. **Página de Visão Global / Dashboard** (Fazer o mock inicial das páginas se precisar ajustar o Design visando tela HD standard - 1366x768 ou 1920x1080).

## Verification Plan
1. Rodar scripts Prisma de CRUD para testar que reservas e pedidos do PDV não apagam ao fechar.
2. Compilar um `Instalador.exe` isolado e ter os testes rodando limpos nele sem um Node explícito.
3. Simular a exclusão local (forçando um "Desastre") e recarregar via .sqlite antigo.
