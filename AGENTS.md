# CATSight.AI — notes for coding agents

Multi-organization RAG over scanned documents (it began as an MSU-IIT thesis).
Each organization has its own library, members, tags and AI provider (its own
OpenRouter/OpenAI key, or the server's Ollama). Django + DRF + Celery + LangGraph backend
(`backend/`), React + Vite + Tailwind v3 + shadcn/ui frontend (`frontend/`),
Postgres + pgvector. See [README.md](README.md) for the architecture.

## Branches
- `master`: the general, multi-organization product.
- `thesis-revision`: the thesis paper (`thesis/`) and the MSU-IIT system it describes.
  The Mac mini (catsight.mjcarnaje.com) serves this branch; never deploy `master` there.
  Tags `thesis-defended` and `thesis-snapshot-2026-10` mark the thesis editions.

## Working rules
- Commit straight to `master` with conventional commits (`feat(chat): …`, `fix(security): …`); only when asked.
- Never commit `.env`, `.env.prod`, `seed/`, `backend/media/` or model weights (`ollama/`).
- Organization data is only ever read through the request's membership
  (`request.membership` / `Document.objects.visible_to(membership)`); keep the
  cross-organization tests in `backend/tests/test_organizations.py` passing.
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
