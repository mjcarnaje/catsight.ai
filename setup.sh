#!/usr/bin/env bash
# First-time local setup: .env, containers, database and your admin account.
#   ./setup.sh
# Then add the sample PDFs with: docker compose exec backend python manage.py ingest /path/inside/container
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review it, then re-run this script."
  exit 0
fi

docker compose up -d --build
echo "Waiting for the backend..."
until docker compose exec -T backend python manage.py showmigrations app >/dev/null 2>&1; do sleep 2; done
docker compose exec -T backend python manage.py migrate --noinput

read -rp "Admin email: " admin_email
read -rsp "Admin password: " admin_password; echo
docker compose exec -T -e ADMIN_EMAIL="$admin_email" -e ADMIN_PASSWORD="$admin_password" backend python manage.py ensure_admin

echo "Ready: http://localhost:3000"
echo "Create your organization: docker compose exec backend python manage.py create_organization \"Your organization\" --admin $admin_email"
echo "Then add its AI provider in Settings → AI provider."
