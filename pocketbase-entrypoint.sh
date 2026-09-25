#!/bin/sh
set -eu

if [ ! -f /pb_data/data.db ]; then
  if [ -z "${PB_ADMIN_EMAIL:-}" ] || [ -z "${PB_ADMIN_PASSWORD:-}" ]; then
    echo "[PocketBase] PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required for first-run setup." >&2
    exit 1
  fi

  echo "[PocketBase] Creating or updating the configured superuser for the fresh data volume."
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir /pb_data
fi

exec pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data --migrationsDir=/app/pb_migrations
