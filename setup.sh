#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# 1. Remove all media files
# ──────────────────────────────────────────────────────────
echo "🗑  Deleting media files..."
# Use sudo for removal to handle permission issues
sudo rm -rf backend/media/avatars/* backend/media/docs/* || {
  echo "⚠️  Warning: Permission issues with media files. Continuing anyway..."
}

# ──────────────────────────────────────────────────────────
# 2. Tear down containers & volumes
# ──────────────────────────────────────────────────────────
echo "🛑  Stopping and removing containers + volumes..."
docker compose down --volumes --remove-orphans

# ──────────────────────────────────────────────────────────
# 3. Remove Postgres data volume (ignore if missing)
# ──────────────────────────────────────────────────────────
echo "💾  Removing old Postgres data volume..."
if docker volume inspect intel-docs_postgres_data &>/dev/null; then
  docker volume rm intel-docs_postgres_data
else
  echo "   (volume intel-docs_postgres_data not found, skipping)"
fi

# ──────────────────────────────────────────────────────────
# 4. Start containers
# ──────────────────────────────────────────────────────────
echo "🚀  Bringing services back up..."
docker compose up -d --build

# Wait for backend container to be healthy/running
MAX_RETRIES=20
RETRY=0
until docker compose ps | grep backend | grep -q "Up"; do
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Backend container did not start in time. Check logs with 'docker compose logs backend'."
    exit 1
  fi
  echo "⏳ Waiting for backend container to be up... ($RETRY/$MAX_RETRIES)"
  sleep 3
  RETRY=$((RETRY+1))
done

# ──────────────────────────────────────────────────────────
# 5. Apply migrations
# ──────────────────────────────────────────────────────────
echo "📦  Applying Django migrations..."
docker compose exec backend python manage.py migrate --noinput

# ──────────────────────────────────────────────────────────
# 6. Pull Ollama models
# ──────────────────────────────────────────────────────────
echo "🤖  Pulling Ollama models..."
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama pull qwen3:1.7b
docker compose exec ollama ollama pull bge-m3:latest
docker compose exec ollama ollama pull qwen2.5:7b-instruct-q4_K_M
docker compose exec ollama ollama pull phi4:latest

# ──────────────────────────────────────────────────────────
# 7. Download Docling models
# ──────────────────────────────────────────────────────────
echo "📥  Downloading Docling models..."
docker compose exec backend docling-tools models download

# ──────────────────────────────────────────────────────────
# 8. Create/update superuser 'admin'
# ──────────────────────────────────────────────────────────
echo "🔐  Ensuring superuser 'admin' exists..."
docker compose exec -T backend python manage.py shell <<'PYCODE'
from django.contrib.auth import get_user_model
User = get_user_model()
email    = "michaeljames.carnaje@g.msuiit.edu.ph"
username = "admin"
password = "password"

if User.objects.filter(email=email).exists():
    u = User.objects.get(email=email)
    u.username = username
    u.set_password(password)
    u.save()
    print(f" • Updated password for existing user '{email}'")
else:
    User.objects.create_superuser(email, password, username=username)
    print(f" • Created new superuser '{email}'")
PYCODE

echo "✅  Reset complete!"

# Start services in foreground or add ngrok if needed
if [ "${1:-}" = "--with-ngrok" ]; then
  echo "🌐  Starting services with ngrok tunnel..."
  docker compose up -d
  ngrok config add-authtoken 2eLYVevP4ZXNVanK4iR20M02eol_29zGNpXFpGsnfyM5exyqs && ngrok http --url=catsightai.ngrok.app 3000
else
  echo "🚀  Starting services in foreground..."
  docker compose up
fi