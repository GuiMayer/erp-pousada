#!/bin/sh
set -eu
[ "${DEMO_MODE:-}" = "true" ] || { echo "Modo demonstração obrigatório" >&2; exit 1; }
psql -h postgres-demo -U pousada_admin -d pousada_demo -v ON_ERROR_STOP=1 --set worker_password="${DEMO_DB_WORKER_PASSWORD:?Defina DEMO_DB_WORKER_PASSWORD}" -f /scripts/db-runtime-grants.sql
