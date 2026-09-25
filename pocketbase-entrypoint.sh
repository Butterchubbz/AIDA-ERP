#!/bin/sh
set -eu

if [ ! -f /pb_data/data.db ]; then
  if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
    echo "[PocketBase] Creating or updating the configured superuser for the fresh data volume."
    pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir /pb_data
  else
    echo "[PocketBase] PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD not set for this fresh data volume."
    echo "[PocketBase] Skipping superuser upsert — open the AIDA app in your browser and the"
    echo "[PocketBase] setup wizard will let you create the first superuser instead."
  fi
fi

exec pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data --migrationsDir=/app/pb_migrations --hooksDir=/app/pb_hooks
