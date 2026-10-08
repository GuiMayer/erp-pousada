#!/bin/sh
set -eu
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-pousada}"
POSTGRES_USER="${POSTGRES_USER:-pousada}"

mkdir -p "$BACKUP_DIR"
# Kernel lock is released automatically on termination; manual and scheduled jobs serialize.
exec 9>"$BACKUP_DIR/.backup.lock"
lock_attempt=0
until flock -n 9; do
  lock_attempt=$((lock_attempt + 1))
  if [ "$lock_attempt" -ge 60 ]; then echo "Outro backup continua em andamento" >&2; exit 1; fi
  sleep 1
done

timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
file="$BACKUP_DIR/pousada_${timestamp}_$$.dump"
temporary="$file.partial"
secondary_temporary=""
finish() {
  status=$?
  rm -f "$temporary"
  if [ -n "$secondary_temporary" ]; then rm -f "$secondary_temporary"; fi
  if [ "$status" -ne 0 ]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/last-error"
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
      curl --fail --silent --max-time 15 -H 'Content-Type: application/json' --data '{"text":"ERP Pousada: falha no backup. Verifique o painel e os destinos configurados."}' "$ALERT_WEBHOOK_URL" >/dev/null || echo "Falha ao entregar alerta de backup" >&2
    fi
  fi
}
trap finish EXIT

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
if [ "${BACKUP_SECONDARY_ENABLED:-false}" = "true" ]; then
  secondary="${BACKUP_SECONDARY_DIR:?Defina a pasta da segunda cópia}"
  test "$secondary" != "$BACKUP_DIR" || { echo "A segunda cópia exige outra pasta" >&2; exit 1; }
  mkdir -p "$secondary"
  secondary_temporary="$secondary/$(basename "$file").partial"
  cp "$file" "$secondary_temporary"
  cmp -s "$file" "$secondary_temporary" || { echo "Segunda cópia diverge do backup original" >&2; exit 1; }
  pg_restore --list "$secondary_temporary" >/dev/null
  mv "$secondary_temporary" "$secondary/$(basename "$file")"
  secondary_temporary=""
  touch "$BACKUP_DIR/last-secondary-success"
fi
if [ -n "${BACKUP_REMOTE:-}" ]; then
  remote_name="${BACKUP_REMOTE%%:*}"
  case "$remote_name" in ''|*[!A-Za-z0-9_-]*) echo "Nome do destino externo inválido" >&2; exit 1;; esac
  rclone listremotes --long | grep -Eq "^${remote_name}:[[:space:]]+crypt$" || { echo "O destino externo deve usar rclone crypt" >&2; exit 1; }
  rclone copyto --contimeout 15s --timeout 60s --retries 2 --low-level-retries 2 "$file" "${BACKUP_REMOTE%/}/$(basename "$file")"
  touch "$BACKUP_DIR/last-remote-success"
fi
touch "$BACKUP_DIR/last-success"
rm -f "$BACKUP_DIR/last-error"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pousada_*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete

echo "$file"
