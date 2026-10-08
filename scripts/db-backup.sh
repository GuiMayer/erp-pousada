#!/bin/sh
set -eu
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-pousada}"
POSTGRES_USER="${POSTGRES_USER:-pousada}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
file="$BACKUP_DIR/pousada_${timestamp}_$$.dump"
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
touch "$BACKUP_DIR/last-local-success"
if [ -n "${BACKUP_REMOTE:-}" ]; then
  remote_name="${BACKUP_REMOTE%%:*}"
  case "$remote_name" in ''|*[!A-Za-z0-9_-]*) echo "Nome do destino externo inválido" >&2; exit 1;; esac
  rclone listremotes --long | grep -Eq "^${remote_name}:[[:space:]]+crypt$" || { echo "O destino externo deve usar rclone crypt" >&2; exit 1; }
  rclone copyto "$file" "${BACKUP_REMOTE%/}/$(basename "$file")"
  touch "$BACKUP_DIR/last-remote-success"
fi
touch "$BACKUP_DIR/last-success"
rm -f "$BACKUP_DIR/last-error"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pousada_*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete

echo "$file"
