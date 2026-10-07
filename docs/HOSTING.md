# Hosting on the Mac mini

CATSight.AI runs as a public demo on a Mac mini, alongside other self-hosted
services, and is published at <https://catsight.mjcarnaje.com> through its own
Cloudflare Tunnel. Everything runs in Docker (`docker-compose.prod.yml`): Postgres + pgvector, Redis, the Django API
(gunicorn), the Celery worker (built with `LOCAL_OCR=1` for Marker), nginx serving the
built frontend, and `cloudflared`. Marker 2's OCR model, Surya OCR 2, runs outside Docker
on the mini's GPU (Docker on macOS can't use it): `scripts/install-ocr-service.sh`
installs llama.cpp and a `com.catsight.ocr` launch agent on 127.0.0.1:8791, and
`.env.prod` points the containers at it with
`SURYA_INFERENCE_URL=http://host.docker.internal:8791/v1`. Without it, start the CPU
container instead (`--profile ocr-cpu`, about 2 minutes per page).

| | |
|---|---|
| Checkout | `~/catsight` on the mini (outside `Documents`) |
| Listens on | `127.0.0.1:8790` (nginx); nothing else is published. Set `WEB_PORT` if 8790 is taken. |
| Public URL | <https://catsight.mjcarnaje.com> via tunnel `catsight-macmini` (outbound only, no port forwarding) |
| Access | The app's own sign-in plus one-click guest accounts. No Cloudflare Access: it's a public demo. |
| Secrets | `~/catsight/.env.prod` (mode 600, gitignored) |
| Data | Docker volumes `catsight_pgdata` (database) and `catsight_media` (PDFs, previews, avatars) |
| Backups | `~/catsight-backups/` (mode 700): `catsight-<ts>.sql.gz` + `media-<ts>.tar.gz` |
| Seed PDFs | `~/catsight/seed/` (gitignored), mounted read-only at `/seed` in the worker |

The mini's database is production's source of truth. A laptop database is a
development copy: never restore it over production or move data through Git.

## Manage it from the laptop

`scripts/catsight-remote` connects over SSH (Tailscale here) with a verified host
key and runs fixed commands in the mini's checkout. It reads the target from a
gitignored `.env.remote` at the repo root; the same variables in the environment
take precedence:

```sh
CATSIGHT_SSH=you@100.x.y.z            # the mini's SSH login, e.g. its Tailscale address
CATSIGHT_HOST_KEY_ALIAS=mini.local    # optional: check the host key under this known_hosts name
CATSIGHT_DIR=catsight                 # optional: the checkout, relative to the remote home
```

Then:

```sh
./scripts/catsight-remote status        # revision, containers, /api/health/
./scripts/catsight-remote logs worker   # follow one service (backend, worker, web, tunnel, db)
./scripts/catsight-remote backup        # pg_dump + media archive
./scripts/catsight-remote deploy        # backup -> fast-forward to origin/master -> build -> up -> health
./scripts/catsight-remote ingest        # add every PDF under ~/catsight/seed to the library
```

`deploy` refuses to run when the mini's checkout has local changes. On the home
network, `CATSIGHT_SSH=you@mini.local ./scripts/catsight-remote status` also works.

## First-time setup

Done once, by the owner, on the mini over SSH:

1. **Docker Desktop**: Settings → General → *Start Docker Desktop when you sign in*.
   Containers use `restart: unless-stopped`, so they return with Docker after a reboot
   (the macOS user must be logged in). Check free space first:
   `docker system df` and `df -h ~`. The images need about 3 GB.
2. **Checkout**: `git clone https://github.com/mjcarnaje/catsight.ai.git ~/catsight`.
3. **Secrets**: create `~/catsight/.env.prod` from `.env.example` with `chmod 600`:

   ```sh
   LLM_PROVIDER=openrouter
   OPENROUTER_API_KEY=...          # a key used only by this demo, with a credit limit
   DJANGO_SECRET_KEY=...           # python3 -c "import secrets; print(secrets.token_urlsafe(50))"
   DJANGO_ALLOWED_HOSTS=catsight.mjcarnaje.com,localhost,127.0.0.1,backend
   PUBLIC_URL=https://catsight.mjcarnaje.com
   POSTGRES_DB=catsight
   POSTGRES_USER=catsight
   POSTGRES_PASSWORD=...           # long random value
   ADMIN_EMAIL=...                 # your admin account, (re)set on every start
   ADMIN_PASSWORD=...
   DEMO_MODE=1
   TUNNEL_TOKEN=...                # from step 5
   ```

4. **OpenRouter key limit**: create a dedicated key at <https://openrouter.ai/settings/keys>
   with a credit limit and a daily or monthly reset. That caps spend even if the
   app's own per-visitor limits were bypassed; requests over the limit fail with a
   clear "credit limit reached" message in the app.
5. **Tunnel**: in Cloudflare Zero Trust → Networks → Tunnels, create
   `catsight-macmini` (cloudflared connector), copy its token into `TUNNEL_TOKEN`,
   and add the public hostname `catsight.mjcarnaje.com` → `http://web:80`
   (the tunnel container reaches nginx on the Compose network). Other tunnels on
   the account are untouched.
6. **Start**: `cd ~/catsight && docker compose -f docker-compose.prod.yml --env-file .env.prod --profile tunnel up -d --build`.
   The backend migrates the database and creates the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
7. **Seed the library**: copy the PDFs from the laptop, then ingest them:

   ```sh
   rsync -av path/to/pdfs/ you@mini:catsight/seed/
   ./scripts/catsight-remote ingest
   ```

   Duplicates (same bytes) are skipped, so re-running is safe. The 50 sample PDFs
   (≈180 pages; 48 unique) cost about $0.30 to OCR, catalogue and embed. Progress
   shows on the dashboard's pipeline card.

## Updating

From the laptop, after pushing to `master`: `./scripts/catsight-remote deploy`.
It backs up first, fast-forwards (never resets) the mini's checkout, rebuilds the
images, restarts the stack (the backend migrates on start) and checks
`/api/health/`. Failed builds leave the running containers in place.

If an update changes `EMBEDDING_MODEL`, re-index every document:
`docker compose -f docker-compose.prod.yml --env-file .env.prod exec worker python manage.py reindex --all`.

## Restoring a backup

```sh
cd ~/catsight
gunzip -c ~/catsight-backups/catsight-<ts>.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend tar -C /usr/src/app -xzf - < ~/catsight-backups/media-<ts>.tar.gz
```

Restore into a fresh database (drop and recreate the `catsight_pgdata` volume
first) to avoid mixing old and new rows.

## Checks

- `./scripts/catsight-remote status` → all containers `running`, health `{"ok": true}`.
- Public: <https://catsight.mjcarnaje.com/api/health/> → 200; the landing page's
  *Try the live demo* opens the dashboard as a guest.
- Link previews: <https://catsight.mjcarnaje.com/og.png> loads (1200×630).
- Worker: `./scripts/catsight-remote logs worker` shows documents moving through
  `extracting → summarizing → indexing → ready`.

## Current deployment

Verified 7 October 2026:

- Tunnel `catsight-macmini` (dashboard-managed, token in `.env.prod`) publishes
  `catsight.mjcarnaje.com` → `http://web:80`; other tunnels on the account are
  unchanged.
- `DEMO_MODE=1`, `UPLOADS_ENABLED=0`: visitors sign in as guests and search and
  chat with the library; only the admin (`ADMIN_EMAIL` in `.env.prod`) can add
  documents, through the UI or `catsight-remote ingest`.
- Library: the 50 MSU-IIT sample PDFs from `seed/` (48 unique; 158 pages, 516
  passages, 1970–2024). Ingest cost $0.22 on OpenRouter.
- Checked publicly: `/api/health/`, landing page, `/og.png`, guest sign-in, a
  refused guest upload, and a streamed, cited chat answer (≈6 s end to end).
