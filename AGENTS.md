# CATSight.AI — notes for coding agents

RAG over scanned MSU-IIT documents. Django + DRF + Celery + LangGraph backend
(`backend/`), React + Vite + Tailwind v3 + shadcn/ui frontend (`frontend/`),
Postgres + pgvector. See [README.md](README.md) for the architecture.

## Branches
- `master`: the general, multi-organization product.
- `thesis-revision`: the thesis paper (`thesis/`) and the MSU-IIT system it describes.
  Tags `thesis-defended` and `thesis-snapshot-2026-10` mark the thesis editions.
- The Mac mini (catsight.mjcarnaje.com) runs one of the two, each with its own database
  and media volumes: `catsight-remote deploy` updates the running edition,
  `deploy general|thesis` switches, only when the user asks for it.
- MSU-IIT documents belong to the thesis edition only; the general demo's library is the
  fictional `samples/demo` (rebuild with `python3 samples/demo/build.py`).

## Working rules
- Commit straight to `master` with conventional commits (`feat(chat): …`, `fix(security): …`); only when asked.
- Never commit `.env`, `.env.prod`, `seed/`, `backend/media/` or model weights (`ollama/`).
- Don't call paid models to "test": the backend suite fakes embeddings and chat.
  A real end-to-end run (ingest, ask) needs the owner's go-ahead.

## Commands
- Dev stack: `docker compose up -d` → <http://localhost:3000> (API on :8000)
- Backend tests: `docker compose exec -T backend python -m pytest`
- Backend lint: `docker compose exec -T -u root backend sh -c "pip install -q ruff && ruff check --select F,E9,B --ignore B008,B904 --exclude app/migrations app inteldocs tests"`
- Frontend types/build: `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build`
- OG image + icons: `cd frontend && npm run og`

## Design (frontend)
Dark, restrained, Linear/Granola-style product UI. Semantic tokens only
(`bg-card`, `text-muted-foreground`, `border`…), hairline borders, mono micro-labels,
white primary buttons. No gradient text, glows, shimmer, border beams or marquees.
Tailwind is v3: don't paste v4-only registry components.

## Skills
- `.agents/skills/catsight-rag-pipeline` — extraction, cataloguing, indexing, retrieval, agent.
- `.agents/skills/deploy-to-mac-mini` — production on the Mac mini ([docs/HOSTING.md](docs/HOSTING.md)).
