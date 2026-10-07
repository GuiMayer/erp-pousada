@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=%~dp0"
set "ENV_FILE=%PROJECT_DIR%.env.backups"
set "CONFIG_DIR=%PROJECT_DIR%config"
set "CONFIG_FILE=%CONFIG_DIR%\app.config.json"

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

call :load_env
if not exist "%ENV_FILE%" call :write_env
if not exist "%PROJECT_DIR%.env" (
  echo Configure .env conforme docs/PRODUCAO.md antes de usar o menu.
  pause
  exit /b 1
)
set "COMPOSE=docker compose --env-file .env --env-file .env.backups -f docker-compose.yml -f compose.https.yml"

:menu
cls
echo ========================================
echo        Pousada - Menu de Manutencao
echo ========================================
echo.
echo Pasta do projeto: %PROJECT_DIR%
echo Pasta de backup: %BACKUP_HOST_DIR%
echo Intervalo backup: %BACKUP_INTERVAL_MINUTES% minuto(s)
echo.
echo  1. Instalar/subir sistema
echo  2. Abrir sistema no navegador
echo  3. Mostrar endereco para celular no Wi-Fi
echo  4. Parar sistema
echo  5. Reiniciar sistema
echo  6. Criar banco vazio do zero
echo  7. Fazer backup agora
echo  8. Restaurar backup .dump
echo  9. Listar backups
echo 10. Ver logs
echo 11. Configurar pasta/intervalo de backup
echo 12. Migrar dados legados para tabelas relacionais
echo 13. Sair
echo.
set /p "choice=Escolha uma opcao: "

if "%choice%"=="1" goto start_stack
if "%choice%"=="2" goto open_browser
if "%choice%"=="3" goto show_wifi
if "%choice%"=="4" goto stop_stack
if "%choice%"=="5" goto restart_stack
if "%choice%"=="6" goto reset_database
if "%choice%"=="7" goto backup_now
if "%choice%"=="8" goto restore_backup
if "%choice%"=="9" goto list_backups
if "%choice%"=="10" goto logs
if "%choice%"=="11" goto configure
if "%choice%"=="12" goto migrate_local_data
if "%choice%"=="13" exit /b 0

echo Opcao invalida.
pause
goto menu

:load_env
if exist "%PROJECT_DIR%.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%PROJECT_DIR%.env") do (
    if /i "%%A"=="APP_URL" set "APP_URL=%%B"
  )
)
if not defined BACKUP_HOST_DIR set "BACKUP_HOST_DIR=%PROJECT_DIR%backups"
if not defined BACKUP_INTERVAL_MINUTES set "BACKUP_INTERVAL_MINUTES=30"
if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /i "%%A"=="BACKUP_HOST_DIR" set "BACKUP_HOST_DIR=%%B"
    if /i "%%A"=="BACKUP_INTERVAL_MINUTES" set "BACKUP_INTERVAL_MINUTES=%%B"
  )
)
if not exist "%BACKUP_HOST_DIR%" mkdir "%BACKUP_HOST_DIR%"
call :write_config
exit /b 0

:write_env
(
  echo BACKUP_HOST_DIR=%BACKUP_HOST_DIR%
  echo BACKUP_INTERVAL_MINUTES=%BACKUP_INTERVAL_MINUTES%
) > "%ENV_FILE%"
call :write_config
exit /b 0

:write_config
(
  echo {
  echo   "dataMode": "database",
  echo   "host": "0.0.0.0",
  echo   "port": 3000,
  echo   "backupDirectory": "%BACKUP_HOST_DIR:\=\\%",
  echo   "backupIntervalMinutes": %BACKUP_INTERVAL_MINUTES%,
  echo   "database": {
  echo     "host": "postgres",
  echo     "port": 5432,
  echo     "name": "pousada",
  echo     "user": "pousada",
  echo     "password": ""
  echo   }
  echo }
) > "%CONFIG_FILE%"
exit /b 0

:start_stack
call :require_docker || goto menu
%COMPOSE% up -d --build
pause
goto menu

:open_browser
start "" "%APP_URL%"
goto menu

:show_wifi
echo Use o dominio HTTPS configurado em APP_URL: %APP_URL%
echo Consulte docs/PRODUCAO.md para DNS e certificado.
pause
goto menu

:stop_stack
call :require_docker || goto menu
%COMPOSE% stop app backup-worker postgres
pause
goto menu

:restart_stack
call :require_docker || goto menu
%COMPOSE% restart
pause
goto menu

:reset_database
call :require_docker || goto menu
echo.
echo ATENCAO: isto apaga o banco atual.
set /p "confirm=Digite APAGAR para continuar: "
if /i not "%confirm%"=="APAGAR" goto menu
%COMPOSE% up -d postgres
%COMPOSE% stop app backup-worker
%COMPOSE% run --rm backup-worker sh /scripts/db-backup.sh
%COMPOSE% run --rm backup-worker sh /scripts/db-reset.sh
%COMPOSE% run --rm app pnpm prisma migrate deploy
%COMPOSE% up -d app backup-worker
pause
goto menu

:backup_now
call :require_docker || goto menu
%COMPOSE% up -d postgres
%COMPOSE% run --rm backup-worker sh /scripts/db-backup.sh
pause
goto menu

:restore_backup
call :require_docker || goto menu
echo.
echo Backups disponiveis em %BACKUP_HOST_DIR%:
dir /b "%BACKUP_HOST_DIR%\*.dump" 2>nul
echo.
set /p "backup_file=Digite o nome do arquivo .dump: "
if not exist "%BACKUP_HOST_DIR%\%backup_file%" (
  echo Arquivo nao encontrado.
  pause
  goto menu
)
echo.
echo ATENCAO: restaurar backup substitui o banco atual.
set /p "confirm=Digite RESTAURAR para continuar: "
if /i not "%confirm%"=="RESTAURAR" goto menu
%COMPOSE% up -d postgres
%COMPOSE% stop app backup-worker
echo Criando backup de seguranca antes da restauracao...
%COMPOSE% run --rm backup-worker sh /scripts/db-backup.sh
%COMPOSE% run --rm backup-worker sh /scripts/db-restore.sh "/backups/%backup_file%"
%COMPOSE% up -d app backup-worker
pause
goto menu

:list_backups
if not exist "%BACKUP_HOST_DIR%" mkdir "%BACKUP_HOST_DIR%"
dir "%BACKUP_HOST_DIR%\*.dump" /O-D
pause
goto menu

:logs
call :require_docker || goto menu
%COMPOSE% logs -f --tail=100
goto menu

:configure
echo.
set /p "new_backup_dir=Nova pasta de backup [%BACKUP_HOST_DIR%]: "
if not "%new_backup_dir%"=="" set "BACKUP_HOST_DIR=%new_backup_dir%"
set /p "new_interval=Intervalo em minutos [%BACKUP_INTERVAL_MINUTES%]: "
if not "%new_interval%"=="" set "BACKUP_INTERVAL_MINUTES=%new_interval%"
if not exist "%BACKUP_HOST_DIR%" mkdir "%BACKUP_HOST_DIR%"
call :write_env
echo Configuracao salva.
pause
goto menu

:migrate_local_data
call :require_docker || goto menu
echo.
echo Esta opcao copia dados antigos de local_data_entries para tabelas relacionais.
echo Crie um backup antes de continuar.
set /p "confirm=Digite MIGRAR para continuar: "
if /i not "%confirm%"=="MIGRAR" goto menu
%COMPOSE% up -d postgres
%COMPOSE% stop app backup-worker
%COMPOSE% run --rm backup-worker sh /scripts/db-backup.sh
%COMPOSE% run --rm app pnpm db:migrate-local-data
%COMPOSE% up -d app backup-worker
pause
goto menu

:require_docker
docker version >nul 2>nul
if errorlevel 1 (
  echo Docker nao esta disponivel. Abra o Docker Desktop e tente novamente.
  pause
  exit /b 1
)
exit /b 0
