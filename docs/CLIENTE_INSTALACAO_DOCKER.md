# Instalacao no PC do cliente com Docker

Este guia assume Windows com Docker Desktop instalado.

## Requisitos

- Docker Desktop instalado e aberto.
- Projeto em uma pasta local do Windows.
- Porta `3000` liberada no Firewall do Windows para acesso pelo celular.
- PC e celular na mesma rede Wi-Fi.

## Primeiro uso

1. Abra a pasta do projeto.
2. Execute `pousada-menu.bat`.
3. Escolha `11. Configurar pasta/intervalo de backup`.
4. Informe a pasta onde os backups devem ser salvos.
5. Informe o intervalo de backup automatico em minutos. Use `0` para desativar.
6. Escolha `1. Instalar/subir sistema`.
7. Escolha `6. Criar banco vazio do zero` se quiser iniciar uma base limpa.
8. Escolha `2. Abrir sistema no navegador`.

## Acesso pelo celular

1. Deixe o sistema rodando no PC.
2. No menu, escolha `3. Mostrar endereco para celular no Wi-Fi`.
3. No celular, abra o endereco exibido, por exemplo `http://192.168.0.10:3000`.
4. Se nao abrir, confira:
   - celular e PC estao no mesmo Wi-Fi;
   - Docker Desktop esta rodando;
   - porta `3000` esta liberada no Firewall;
   - o roteador nao esta bloqueando comunicacao entre dispositivos.

Para maior estabilidade, configure IP fixo no PC ou reserva DHCP no roteador.

## Backups

O backup manual fica no menu `7. Fazer backup agora`.

O backup automatico roda enquanto os containers estiverem ativos, usando o intervalo definido na configuracao.

Cada backup gera um unico arquivo `.dump` com data e hora no nome:

```text
pousada_2026-05-31_14-30-00.dump
```

## Restaurar backup

1. Coloque o arquivo `.dump` na pasta de backup configurada.
2. Execute `pousada-menu.bat`.
3. Escolha `8. Restaurar backup .dump`.
4. Digite o nome do arquivo.
5. Confirme digitando `RESTAURAR`.

Antes da restauracao, o menu cria um backup de seguranca do estado atual.

## Criar banco vazio do zero

Use `6. Criar banco vazio do zero`.

Esta opcao apaga o banco atual, cria backup antes da limpeza, recria o schema publico e aplica as migrations Prisma.

O banco operacional deve iniciar vazio. Dados demonstrativos devem ser carregados apenas por uma acao separada.

## Dados e localStorage

No modo de cliente, os dados reais devem ficar no PostgreSQL dentro do Docker.

O `localStorage` deve ser usado apenas para configuracoes locais de interface ou modo demo explicito, nunca como armazenamento principal de reservas, quartos, financeiro, restaurante ou administracao.

## Comandos uteis sem menu

Subir sistema:

```powershell
docker compose up -d --build
```

Parar sistema:

```powershell
docker compose stop app backup-worker postgres
```

Ver logs:

```powershell
docker compose logs -f --tail=100
```

Validar configuracao Docker:

```powershell
docker compose config
```
