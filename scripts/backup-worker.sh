#!/bin/sh
set -eu

INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-30}"

if [ "$INTERVAL_MINUTES" = "0" ]; then
  echo "Automatic backups disabled."
  tail -f /dev/null
fi

sh /scripts/db-wait.sh

while true; do
  echo "Creating scheduled backup..."
  sh /scripts/db-backup.sh
  sleep "$((INTERVAL_MINUTES * 60))"
done
