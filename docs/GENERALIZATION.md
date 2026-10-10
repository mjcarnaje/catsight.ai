# Preserving the thesis, generalizing CATSight

Decisions from the planning interview of 10 October 2026. CATSight was built and
defended as a thesis about MSU-IIT's administrative documents; the paper is still
being revised. This plan keeps that system reproducible and turns `master` into a
general, multi-organization product.

## Where things stand

| What | Where | Note |
|---|---|---|
| Revised thesis (LaTeX, PDF, screenshots) | branch `thesis-revision` (`e6cef74`) | still being edited; no tag yet |
| Code the thesis describes | `master` @ `c1fc30f` | identical to the code on `thesis-revision` |
| Library: 48 documents, 556 passages, 13 tags, 48 PDFs in media | production database + media on the host | only copy |
| 50 source PDFs (48 unique, the same files as in media) | host's `seed/` | only copy; not covered by the MIT license |
| 21 users, 45 chats | production database | only copy |
| Backups | host's own disk | no off-machine copy; disk nearly full |

`scripts/catsight-remote deploy` pulls `origin/master`, so once `master` changes, a
deploy would silently replace the system the thesis describes.

## Decisions

### Preservation
- The hosted site stays a **frozen thesis demo**. The general version is not deployed there.
- `thesis-revision` remains the branch for paper edits and for any fix to the demo.
- Tags: `thesis-defended` on `e4ce7ab` (the defended edition, so the defended-vs-revised diff
  no longer depends on `HEAD~1`), `thesis-snapshot-2026-10` on `e6cef74` now, and
  `thesis-final` when the paper is approved.
- Deploy guard: `catsight-remote deploy` deploys `CATSIGHT_DEPLOY_REF` from `.env.remote`
  (set to `thesis-revision`) and refuses `master` unless asked explicitly. The guard has to
  live on both branches, because the script runs from whatever branch is checked out.
- The rule is also written where other coding agents read it: `AGENTS.md`, `docs/HOSTING.md`
  and `.agents/skills/deploy-to-mac-mini` (which today says "push to master"), on both branches.
- Off-machine archive of a fresh full dump (users and chats included), the media archive and
  the 50 seed PDFs, with SHA-256 checksums and restore steps:
  1. on the MacBook, outside the repo;
  2. in a **private** repository `mjcarnaje/catsight-thesis-archive` (it holds user emails and
     password hashes, so it must never be public).
- The archive is verified by restoring it into a throwaway pgvector container and checking
  48 documents, 556 passages, 21 users, 45 chats and 48 PDFs in the media archive; the
  manifest records those counts (`docs/HOSTING.md`'s "516 passages" is stale; the library
  now has 556).
- After the archive is verified: prune old backups on the host (keep the two newest) and
  `docker builder prune` (shared build cache; other services keep running).
- The MIT `LICENSE` is cherry-picked to `master`.
- The thesis gets one paragraph in Chapter 7 (Recommendations) proposing multi-organization
  support; Chapters 1-6 keep describing the defended system.

### General version (`master`)
- **Audience:** any documents, not only administrative ones. Reference number and issue date
  stay as optional catalogue fields, filled only when a document has them.
- **Organizations:** `Organization` plus `Membership(user, org, role)`; roles move from `User`
  to the membership. A user can belong to several orgs (org switcher).
- **Onboarding:** only the super admin creates orgs; org admins invite members by email.
  Optional auto-join by email domain replaces the global `ALLOWED_EMAIL_DOMAINS`.
- **Data scoping:** documents, tags, chats and usage events belong to an org. Tag names are
  unique per org. Every retrieval path (hybrid search, the agent's search tool, the search
  answer) filters by org, with tests that one org can never retrieve another's passages.
- **Bring your own key:** each org stores an OpenRouter **or** OpenAI key.
  - Encrypted at rest with a server secret; write-only (the API returns provider and last
    four characters); checked with a cheap call on save; managed by org admins only.
  - All models are configurable per org (chat, fast, OCR, embedding, reranker).
  - Embeddings must return 1024 values (bge-m3, or OpenAI `text-embedding-3` with
    `dimensions=1024`); validated on save. Changing the embedding model warns how many
    documents will be re-embedded with the org's key, then queues a reindex.
  - OpenAI orgs: Marker's LLM mode uses an OpenAI vision model; reranking is skipped
    (no rerank endpoint), so results keep their fused score.
  - An org without a key is read-only: members can browse, but upload, answers and chat are off.
- **Tags:** per-org, seeded from a preset when the org is created: "General" (Report,
  Contract, Policy, Memo, Letter, Other) or "MSU-IIT" (today's 13 tags).
- **Guests:** `DEMO_MODE` stays; guests join one designated demo org (`DEMO_ORG`), read-only,
  using that org's key. Every other org is invite-only.
- **Brand:** keep the CATSight name and mascot; replace the MSU-IIT maroon with a neutral
  accent; the footer shows the organization's name.
- **Where:** built and tested locally with Docker Compose on an empty database. Hosting is
  decided once it works.

## MSU-IIT references to generalize

| File | What |
|---|---|
| `backend/app/constant/prompts.py:3,41,77` | agent, cataloguing and search-answer prompts name MSU-IIT and its document types |
| `backend/app/services/agent.py:127` | search tool description |
| `backend/app/migrations/0020_curate_tags.py` | MSU-IIT tags created by a migration (becomes the "MSU-IIT" preset) |
| `backend/app/models.py:85` | `reference_number` example in a comment |
| `frontend/src/components/chat/empty-chat.tsx:9` | example questions |
| `frontend/src/components/landing/site-footer.tsx:17` | "MSU-IIT" in the footer |
| `frontend/src/index.css:9` | maroon brand colour |
| `README.md`, `AGENTS.md`, `docs/HOSTING.md` | describe the MSU-IIT demo |

## Still open
- **Ollama.** Today `LLM_PROVIDER=ollama` is the self-hosted, key-free path, and the only way
  to exercise a local build without paid calls. Either a third per-org provider
  ("ollama": base URL, no key) or self-hosting is retired. This shapes the `llm.py` refactor.
- Accent colour that replaces maroon.
- How invitations are sent (email provider) and accepted.
- What deleting an org does to its documents, media and vectors.
- Rotating the key-encryption secret.
- Whether the existing per-user limits still apply when an org pays with its own key.
- What the multi-org migration does with rows that already exist (e.g. a "default" org).

## Order of work
1. **Preserve**, in this order, each step only after the previous one checks out: fresh
   backup → copy to the MacBook → restore into a throwaway container and check the counts →
   prune old backups and the build cache on the host → push the tags → private archive
   repository. Then the deploy guard and agent-facing docs (committed to `master`,
   cherry-picked to `thesis-revision`) and LICENSE on `master`. This file belongs on `master`.
2. **Thesis:** the Chapter 7 recommendation paragraph on `thesis-revision`.
3. **Multi-org on `master`:** organizations and memberships → org scoping and leak tests →
   per-org AI configuration and keys → tag presets and generic prompts → demo org and brand.
