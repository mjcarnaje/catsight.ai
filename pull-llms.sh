#!/usr/bin/env bash
set -euo pipefail

# pull-llms.sh: Bring up containers (if needed) and pull LLM/Docling models only

# ──────────────────────────────────────────────────────────
# Platform detection for GPU support
# ──────────────────────────────────────────────────────────
# Usage: ./pull-llms.sh [mac|pc]   (auto-detects when omitted)
source ./platform.sh "${1:-}"

# ──────────────────────────────────────────────────────────
# 1. Ensure containers are running
# ──────────────────────────────────────────────────────────
echo "🚀  Bringing services up (if not already running)..."
docker compose $COMPOSE_FILES up -d --build

# Wait for backend container to be running before pulling models
MAX_RETRIES=20
RETRY=0
until docker compose $COMPOSE_FILES ps | grep backend | grep -q "Up"; do
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Backend container did not start in time. Check logs with 'docker compose $COMPOSE_FILES logs backend'."
    exit 1
  fi
  echo "⏳ Waiting for backend container to be up... ($RETRY/$MAX_RETRIES)"
  sleep 3
  RETRY=$((RETRY+1))
done

# ──────────────────────────────────────────────────────────
# 2. Pull Ollama LLM models
# ──────────────────────────────────────────────────────────
echo "🤖  Pulling Ollama models..."
# Keep in sync with CHAT_MODEL / FAST_MODEL / EMBEDDING_MODEL in backend/inteldocs/settings.py
docker compose $COMPOSE_FILES exec ollama ollama pull qwen3:4b-instruct-2507-q4_K_M  # chat answers + summaries (~2.5 GB)
docker compose $COMPOSE_FILES exec ollama ollama pull qwen3:1.7b  # chat titles, quick checks (~1.4 GB)
docker compose $COMPOSE_FILES exec ollama ollama pull bge-m3      # embeddings for search (~1.2 GB)

# # ──────────────────────────────────────────────────────────
# # 3. Download Docling models
# # ──────────────────────────────────────────────────────────
# echo "📥  Downloading Docling models..."
# docker compose $COMPOSE_FILES exec backend docling-tools models download

echo "✅  LLM and Docling models pulled!"
