@echo off
setlocal
cd /d "%~dp0"
:menu
cls
echo ERP Pousada - Docker e PostgreSQL
echo 1. Preparar instalacao vazia
echo 2. Iniciar ou atualizar
echo 3. Verificar instalacao
echo 4. Fazer backup agora
echo 5. Abrir sistema
echo 0. Sair
set /p "option=Escolha: "
if "%option%"=="0" exit /b 0
if "%option%"=="1" powershell -NoProfile -File scripts/setup-docker.ps1
if "%option%"=="2" powershell -NoProfile -File scripts/start-docker.ps1
if "%option%"=="3" powershell -NoProfile -File scripts/check-installation.ps1
if "%option%"=="4" docker compose --env-file .env.docker.local -f docker-compose.yml -f compose.lan.yml exec -T backup-worker sh /scripts/db-backup.sh
if "%option%"=="5" powershell -NoProfile -File scripts/open-system.ps1
pause
goto menu
