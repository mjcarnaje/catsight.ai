#!/bin/sh
# Production start-up for the web container: migrate, collect static files,
# make sure the admin exists (when ADMIN_EMAIL/ADMIN_PASSWORD are set), then serve.
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput -v 0
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  python manage.py ensure_admin
fi
exec "$@"
