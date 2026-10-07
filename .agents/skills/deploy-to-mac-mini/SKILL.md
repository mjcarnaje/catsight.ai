---
name: deploy-to-mac-mini
description: Deploy CATSight.AI to the Mac mini (catsight.mjcarnaje.com) over SSH/Tailscale — push to master, back up the production database and media, fast-forward the mini's checkout, rebuild the Docker stack and verify health — while keeping the mini's data authoritative. Use when the user asks to deploy, ship, release, update the hosted demo, seed its library, or check on it.
---

# Deploy CATSight.AI to the Mac mini

Read [the hosting guide](../../../docs/HOSTING.md) first: host, checkout, ports,
secrets, volumes and the tunnel are documented there. A deploy is **Git for code,
never for data**: the laptop pushes, the mini fast-forwards. The mini's Postgres
volume and media volume are production's source of truth.

All remote work goes through `./scripts/catsight-remote` (Tailscale address,
verified host key, fixed commands). Don't improvise other SSH commands that
change state.

## 1. Prepare on the laptop

1. `git status` / `git fetch`: commit only files belonging to the change — never
   `.env*`, `seed/`, `backend/media/` or scratch scripts.
2. Backend checks: `docker compose exec -T backend python -m pytest` (no model
   calls; the suite fakes them).
3. Frontend checks: `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build`.
4. Conventional commit on `master`, then `git push origin master`.

## 2. Deploy

```sh
./scripts/catsight-remote status   # what's running now
./scripts/catsight-remote deploy   # backup -> ff-only merge -> build -> up -d -> health
```

- `deploy` stops if the mini's checkout has local changes: show them to the user
  and reconcile explicitly. Never `git reset`, `checkout --` or `clean` there.
- It backs up to `~/catsight-backups/` before touching anything. Report the
  backup file names.
- A failed build leaves the old containers running; read the error, fix, redeploy.
- Changing `EMBEDDING_MODEL` needs `manage.py reindex --all` afterwards (this
  calls the paid embedding API for every chunk: ask first).

## 3. Verify

- `./scripts/catsight-remote status`: every container running, `/api/health/` → `{"ok": true}`.
- Public: `curl -sI https://catsight.mjcarnaje.com/api/health/` → 200, and
  `https://catsight.mjcarnaje.com/og.png` → 200.
- `./scripts/catsight-remote logs worker` for pipeline errors after a deploy
  that touched extraction, summarization or indexing.
- Ask the user to click *Try the live demo* and ask a question: you can't judge
  answer quality from logs.

## Things that need the user's explicit go-ahead

- Ingesting PDFs (`catsight-remote ingest`) or `reindex`: they spend OpenRouter credit.
- Creating or changing the Cloudflare tunnel, DNS, or the OpenRouter key/limit.
- Restoring a backup or deleting volumes.
- Anything touching Mission Control (`~/mission-control`, port 8787) or
  Lumen Sanctorum (`~/catholic-stories`, port 47819): out of scope.
