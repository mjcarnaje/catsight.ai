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
# 6. Pull LLM and Docling models (delegated to pull-llms.sh)
# ──────────────────────────────────────────────────────────
echo "🤖  Pulling LLM and Docling models via pull-llms.sh..."
./pull-llms.sh

# ──────────────────────────────────────────────────────────
# 7. Create/update superuser 'admin'
# ──────────────────────────────────────────────────────────
echo "🔐  Ensuring superuser 'admin' exists..."
docker compose exec -T backend python manage.py shell <<'PYCODE'
from django.contrib.auth import get_user_model
User = get_user_model()
email    = "michaeljames.carnaje@g.msuiit.edu.ph"
username = "mjcarnaje"
password = "password"
first_name = "Michael James"
last_name = "Carnaje"

if User.objects.filter(email=email).exists():
    u = User.objects.get(email=email)
    u.username = username
    u.set_password(password)
    u.save()
    u.first_name = first_name
    u.last_name = last_name
    u.is_onboarded = True
    u.save()
    print(f" • Updated password for existing user '{email}'")
else:
    User.objects.create_superuser(email, password, username=username, first_name=first_name, last_name=last_name)
    print(f" • Created new superuser '{email}'")
PYCODE

echo "✅  Reset complete!"

# ──────────────────────────────────────────────────────────
# 8. Seed document tags
# ──────────────────────────────────────────────────────────
echo "🏷️  Seeding document tags..."
docker compose exec backend python manage.py seed_document_tags

echo "🚀  Starting services in foreground..."
docker compose up
