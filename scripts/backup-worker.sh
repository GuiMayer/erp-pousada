#!/bin/sh
set -eu

INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-30}"
case "$INTERVAL_MINUTES" in ''|*[!0-9]*) echo "Intervalo de backup inválido" >&2; exit 1;; esac

if [ "$INTERVAL_MINUTES" = "0" ]; then
  echo "Automatic backups disabled."
  tail -f /dev/null
fi

sh /scripts/db-wait.sh

while true; do
  echo "Creating scheduled backup..."
  if ! sh /scripts/db-backup.sh; then
    mkdir -p "${BACKUP_DIR:-/backups}"
    date -u +%Y-%m-%dT%H:%M:%SZ > "${BACKUP_DIR:-/backups}/last-error"
    echo "Backup falhou; nova tentativa no próximo intervalo." >&2
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
      curl --fail --silent --max-time 15 -H 'Content-Type: application/json' --data '{"text":"ERP Pousada: falha no backup. Verifique o computador da pousada."}' "$ALERT_WEBHOOK_URL" >/dev/null || echo "Falha ao entregar alerta de backup" >&2
    fi
  fi
  sleep "$((INTERVAL_MINUTES * 60))"
done
