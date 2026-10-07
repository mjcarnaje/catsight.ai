#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Platform detection for GPU support
# ──────────────────────────────────────────────────────────
# Usage: ./migrate.sh [mac|pc]   (auto-detects when omitted)
source ./platform.sh "${1:-}"

echo "🚀  Bringing services up (if not already running)..."
docker compose $COMPOSE_FILES up -d

echo "🚀  Migrating database..."
docker compose $COMPOSE_FILES exec backend python manage.py makemigrations
docker compose $COMPOSE_FILES exec backend python manage.py migrate

echo "✅  Database migrated!"
