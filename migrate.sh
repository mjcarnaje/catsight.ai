#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Platform detection for GPU support
# ──────────────────────────────────────────────────────────
COMPOSE_FILES="-f docker-compose.yml"

# Detect if running on Linux with NVIDIA GPU
if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v nvidia-smi &> /dev/null; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.gpu.yml"
fi

echo "🚀  Bringing services up (if not already running)..."
docker compose $COMPOSE_FILES up -d

echo "🚀  Migrating database..."
docker compose $COMPOSE_FILES exec backend python manage.py makemigrations
docker compose $COMPOSE_FILES exec backend python manage.py migrate

echo "✅  Database migrated!"
