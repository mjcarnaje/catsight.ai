---
name: catsight-rag-pipeline
description: How CATSight.AI turns an uploaded PDF into searchable, citable passages (vision OCR or local marker/docling, single-call cataloguing, chunking, bge-m3 + full-text indexing) and how hybrid retrieval and the chat agent use them. Use when touching backend/app/services/{extraction,summarization,indexing,search,agent,llm}.py or backend/app/tasks/tasks.py, debugging bad or empty extracted text, wrong titles/years/tags, missing or irrelevant search results, citation numbering, or provider/model configuration (OpenRouter vs Ollama).
---

# CATSight.AI RAG pipeline

## Where things live

| What | Where |
|---|---|
| Provider seam (chat, embeddings, rerank, page OCR) | `backend/app/services/llm.py` — everything goes through it; `LLM_PROVIDER=openrouter|ollama` |
| Model defaults + knobs | `backend/inteldocs/settings.py` (`CHAT_MODEL`, `OCR_MODEL`, `EMBEDDING_MODEL`, `RERANKER_MODEL`, `RETRIEVAL_MIN_SIMILARITY`, `DEFAULT_TEXT_EXTRACTOR`) |
| Pipeline task + stages | `backend/app/tasks/tasks.py` (`process_document`, `reprocess`) |
| PDF → pages | `backend/app/services/extraction.py` (`vision`, `marker`, `docling`, `markitdown`) |
| Cataloguing | `backend/app/services/summarization.py` (`analyze`) + `ANALYSIS_PROMPT` in `backend/app/constant/prompts.py` |
| Chunking | `backend/app/utils/chunking.py` (`split_markdown`: page + heading aware) |
| Indexing | `backend/app/services/indexing.py` (`index_document`, `chunk_context`) |
| Retrieval | `backend/app/services/search.py` (`search`, `fuse`, `keyword_terms`) |
| Chat agent | `backend/app/services/agent.py` (LangGraph + Postgres checkpointer), SSE in `backend/app/views/chat.py` |
| Upload / dedupe / limits | `backend/app/services/library.py`, `storage.py`, `quotas.py` |

## Pipeline

`process_document(document_id)` runs `queued → extracting → summarizing → indexing → ready`,
starting at the document's current stage. A failure sets `is_failed=True` and a
readable `error_message` but keeps the stage, so `POST /api/documents/<id>/reprocess/`
resumes there. `reprocess(doc, stage)` restarts from any stage (editing the text
restarts at `summarizing`; changing the extractor at `extracting`).

1. **Extracting** — `extraction.extract(path, extractor)` returns `Page`s.
   - `vision` (default with OpenRouter): each page rendered with pypdfium2 at 150 DPI
     (max 2400 px) and transcribed by `OCR_MODEL` with `OCR_PROMPT`, 4 pages at a
     time. It ignores the "UNOFFICIAL COPY" watermark and letterhead contact lines.
   - `marker` / `docling` / `markitdown` need an image built with `LOCAL_OCR=1`.
     `markitdown` only reads a text layer: empty for scans (the step then fails
     with a hint instead of storing nothing).
   - Pages are joined with `<!-- page:N -->` markers (`join_pages`) into
     `DocumentFullText.text`; the markers survive edits and give chunks their page.
2. **Summarizing** — `summarization.analyze(markdown)`: one structured call over the
   whole text (`DocumentAnalysis`: title, summary, reference_number, issued_on, year,
   tags, questions). Only text longer than `SINGLE_PASS_CHARS` is summarized section
   by section first. Tags must match existing `Tag` names (case-insensitive); the
   tag descriptions are what the model chooses by.
3. **Indexing** — `split_markdown` (1000 chars, 150 overlap, never across headings),
   each chunk embedded as `"{context}\n{text}"` where `context` = title · reference
   number · year. Embeddings are computed before old chunks are deleted, so a
   failure leaves the previous index searchable. `update_search_vectors` builds the
   tsvector (context weight A, text B) after normalising leading zeros.

## Retrieval (`search.search`)

- Scope: ready, non-failed documents the user may see (`Document.objects.visible_to`)
  narrowed by document ids / years / tags.
- Vector leg: exact cosine distance (no ANN index on purpose; see the
  `DocumentChunk` docstring). Keyword leg: OR of terms via `to_tsquery('english')`.
- Reciprocal Rank Fusion (`fuse`, k=60), vector-only hits must reach
  `RETRIEVAL_MIN_SIMILARITY`, optional rerank through OpenRouter `/rerank`
  (`RERANKER_MODEL`, failures fall back to the fused order), max 3 passages per document.
- Identifier queries ("SO 01592-2023", "1592") work because `keyword_terms` and the
  index both strip leading zeros and split on hyphens.

## Chat agent

`assistant` may call `search_documents` up to 3 times per question. Sources are
numbered per answer and keep their number across searches (`merge_sources`), so
`[n]` in the text always matches `sources[n]` in the UI. Earlier turns' raw search
results are left out of the prompt (`_model_context`). `truncate_from` powers
regenerate/edit; `delete_chat` also deletes the thread's checkpoints.

## Debugging checklist

- Bad text: `GET /api/documents/<id>/text/` (or the Text tab). Re-run from
  extracting with another extractor if available.
- Wrong catalogue: correct it in the UI (`PATCH /api/documents/<id>/`: chunk
  headers and search vectors are refreshed without re-embedding) or re-run from
  summarizing.
- Missing results: try the same query on `/search` (shows which leg matched each
  passage); check the document is `ready` and visible to that user.
- Tests: `docker compose exec -T backend python -m pytest` — fake embedder and
  scripted chat model, no API calls.
