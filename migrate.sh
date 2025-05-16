#!/usr/bin/env bash
set -euo pipefail

echo "🚀  Bringing services up (if not already running)..."
docker compose up -d

echo "🚀  Migrating database..."
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

echo "✅  Database migrated!"
