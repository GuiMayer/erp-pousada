#!/bin/sh
set -eu
psql -h postgres -U pousada_admin -d pousada -v ON_ERROR_STOP=1 --set worker_password="${DB_WORKER_PASSWORD:?Defina DB_WORKER_PASSWORD}" -f /scripts/db-runtime-grants.sql
