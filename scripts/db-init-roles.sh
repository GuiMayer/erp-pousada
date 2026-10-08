#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
  --set app_password="${DB_APP_PASSWORD:?Defina DB_APP_PASSWORD}" \
  --set migrator_password="${DB_MIGRATOR_PASSWORD:?Defina DB_MIGRATOR_PASSWORD}" \
  --set backup_password="${DB_BACKUP_PASSWORD:?Defina DB_BACKUP_PASSWORD}" \
  --file /scripts/db-roles.sql
