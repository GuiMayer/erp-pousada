#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-pousada}"
POSTGRES_USER="${POSTGRES_USER:-pousada}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
file="$BACKUP_DIR/pousada_${timestamp}.dump"
temporary="$file.partial"
trap 'rm -f "$temporary"' EXIT

PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  -f "$temporary"

pg_restore --list "$temporary" >/dev/null
mv "$temporary" "$file"
touch "$BACKUP_DIR/last-success"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pousada_*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete

echo "$file"
