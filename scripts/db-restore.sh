#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: db-restore.sh /backups/file.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-pousada}"
POSTGRES_USER="${POSTGRES_USER:-pousada}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}" pg_restore \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --exit-on-error \
  --single-transaction \
  --clean \
  --if-exists \
  --no-owner \
  "$BACKUP_FILE"
