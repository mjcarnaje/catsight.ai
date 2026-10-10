#!/usr/bin/env bash
# Pull the server's local models (~5 GB), for organizations the super admin lets use Ollama.
#   ./pull-llms.sh
set -euo pipefail

compose=(docker compose)
[[ "${GPU:-0}" == "1" ]] && compose+=(-f docker-compose.yml -f docker-compose.gpu.yml)

"${compose[@]}" --profile ollama up -d ollama
# Keep in sync with the "ollama" defaults in backend/inteldocs/settings.py
for model in qwen3:4b-instruct-2507-q4_K_M qwen3:1.7b bge-m3; do
  echo "Pulling $model"
  "${compose[@]}" exec ollama ollama pull "$model"
done
echo "Done. Start the app with: LOCAL_OCR=1 docker compose --profile ollama up --build"
