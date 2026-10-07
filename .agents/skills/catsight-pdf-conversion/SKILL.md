---
name: catsight-pdf-conversion
description: How CATSight.AI turns uploaded PDFs into Markdown with marker, docling or markitdown, and how that feeds chunking, summarization and pgvector embedding. Use when touching backend/app/tasks/tasks.py, changing marker or docling options, adding or debugging a markdown converter, investigating bad/empty extracted text, OCR quality, slow or failing extraction in the Celery worker, or CPU vs GPU (TORCH_DEVICE) behaviour of the conversion models.
---

# CATSight.AI PDF → Markdown pipeline

## Where things live

| What | Where |
|---|---|
| Converters + Celery tasks | `backend/app/tasks/tasks.py` |
| Converter names (`marker`, `markitdown`, `docling`) | `MarkdownConverter` enum in `backend/app/constant/__init__.py` |
| Status machine + ordering | `DocumentStatus` / `STATUS_ORDER` in the same file |
| Per-document converter | `Document.markdown_converter` (`backend/app/models.py`) |
| Per-user default | `User.default_markdown_converter`, default `"marker"` |
| Upload picks converter | `backend/app/views/documents.py` (~L111: request value, else user default) |
| Re-extract with another converter | `reextract_doc` in `documents.py`: deletes vectors (`doc_id` filter) + `DocumentFullText`, resets to `PENDING`, re-queues |
| Extracted text storage | `DocumentFullText.text` |
| Files on disk | `MEDIA_ROOT = backend/media` (`/usr/src/app/media` in containers) |
| Chunking (page + section aware) | `backend/app/utils/chunking.py` (`split_markdown`) |
| Vector store helpers | `backend/app/services/vectorstore.py`: `search_chunks`, `get_document_chunks`, `delete_document_chunks` |
| Model tags + Ollama URL | `backend/inteldocs/settings.py` (`CHAT_MODEL`, `FAST_MODEL`, `EMBEDDING_MODEL`, `OLLAMA_BASE_URL`); clients from `services/ollama.py` |

## Flow

`process_document_task(document_id)` (queued with `.delay`) reads the saved status *before* marking the document `PROCESSING`, then runs only the unfinished steps (via `STATUS_ORDER`):

1. `extract_text_task`: picks the converter from `CONVERTERS[document.markdown_converter]` and writes Markdown to `DocumentFullText`. Status goes `TEXT_EXTRACTING` → `TEXT_EXTRACTION_DONE`. A converter exception or an empty result **fails the document** and stops the pipeline.
2. `generate_document_summary_task`: map-reduce summary, then one structured call for `title`, `year` (null when unstated) and `tags` (`services/summarization_agent.py`), with `max_concurrency=SUMMARY_MAX_CONCURRENCY`.
3. `chunk_and_embed_text_task`: `split_markdown()` splits at headings (each chunk starts with its heading and records `page` + `section`), then `save_document_chunks` deletes the old chunks and upserts new ones with stable ids `doc_{id}_chunk_{i}`, then `COMPLETED`.

Tasks run in the `celery_worker` container (`celery -A inteldocs worker --concurrency=1`), not in `backend`.

## The three converters

All three are created lazily behind `@lru_cache(maxsize=1)`, so each worker process loads its models once on the first document and reuses them. With `--concurrency=1` there is a single copy in memory. Raising concurrency multiplies model memory, because each worker process loads its own copy.

### marker (`get_marker_converter`)
Built from `ConfigParser(marker_config)` → `PdfConverter(...)`, then `text_from_rendered(rendered)` returns the Markdown. The current config:
- `force_ocr: True`, `strip_existing_ocr: True`: always re-OCRs, even PDFs that already have a text layer. This is the right choice for scanned documents but the slowest path for digital PDFs.
- `paginate_output: True`: page separators (`{n}` + 48 dashes) appear in the Markdown. `split_markdown` strips them and turns them into each chunk's `page`, so keep this on.
- `format_lines: True`, `disable_image_extraction: True`, `output_format: "markdown"`.
- `use_llm: False`: the Ollama settings (`settings.OLLAMA_BASE_URL`, `settings.CHAT_MODEL`) are **unused** unless you flip this.
- `create_model_dict()` loads the layout/OCR models, which are downloaded on first use rather than baked into the image. Expect the first conversion after a fresh container to be slow.

### docling (`get_docling_converter`)
Uses a plain `DocumentConverter()` with default pipeline options, then `result.document.export_to_markdown()`. To tune OCR or tables, pass `format_options` with `PdfPipelineOptions` (for example `do_ocr`, `do_table_structure`). Check the installed docling version's API before editing, because these options have moved between releases. Its models are also downloaded on first use.

### markitdown (`get_markitdown_converter`)
`MarkItDown().convert(path).text_content`. It's fast and uses no ML models, but it does no OCR, so scanned PDFs come back nearly empty.

## CPU vs GPU

- `TORCH_DEVICE` is set by compose: `cpu` in `docker-compose.mac.yml` and the base file, `cuda` in `docker-compose.pc.yml`. marker reads it.
- The torch wheel is chosen at build time by the `TORCH_INDEX_URL` build arg in `backend/Dockerfile`. It defaults to CPU, and `docker-compose.pc.yml` sets cu124. Torch is installed **before** `requirements.txt` so that marker-pdf and docling reuse it instead of pulling another torch.
- On Mac (CPU), marker with `force_ocr` is slow: expect minutes per multi-page scan.

## Gotchas

- **Never add the PyPI package `marker`.** It's an unrelated tool that installs into the same `marker/` package as `marker-pdf` and breaks `from marker.converters...` (this once silently broke the default converter). Check with `python -c "from marker.converters.pdf import PdfConverter"` in the container.
- **Failed documents:** `is_failed=True` and `status` is the step that failed. Read the worker logs (`logger.exception`) for the cause; retrying resumes from that step.
- **Deleting chunks:** `PGVector.delete()` only accepts explicit ids and silently ignores `filter=`. Use `delete_document_chunks(doc_id)`. To list a document's chunks use `get_document_chunks(doc_id)`, not a similarity search for `""`.
- Ollama is reached at `settings.OLLAMA_BASE_URL` (`http://ollama:11434`, the compose service name).
- Adding a converter means touching the `MarkdownConverter` enum, a new `get_*_converter` / `convert_pdf_with_*` pair registered in `CONVERTERS` (tasks.py), and the frontend option list (`frontend/src/lib/markdown-converter.tsx`, used by `upload-documents-modal.tsx`).

## Trying a converter by hand

Run these from the repo root. `platform.sh` sets `$COMPOSE_FILES` for mac or pc.

```bash
source ./platform.sh
docker compose $COMPOSE_FILES exec celery_worker python manage.py shell -c "
from app.tasks.tasks import convert_pdf_with_docling
print(convert_pdf_with_docling('/usr/src/app/media/docs/<file>.pdf')[:2000])"
```

Swap in `convert_pdf_with_marker` or `convert_pdf_with_markitdown` to compare outputs on the same file.
