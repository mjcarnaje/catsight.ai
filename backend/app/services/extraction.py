"""PDF -> Markdown, one page at a time.

Every extractor returns a list of pages. They're joined with invisible
`<!-- page:N -->` markers, so the chunker knows which page each passage came
from (citations like "p. 3") whichever extractor produced the text, and the
markers don't show when the Markdown is rendered or edited.

- vision     page images -> OCR_MODEL through OpenRouter (default for the demo;
             reads scans with no text layer and ignores watermarks)
- marker     local OCR models (needs the local-ocr image)
- docling    local layout + OCR models (needs the local-ocr image)
- markitdown local, text layer only: fast, but empty for scanned pages
"""
from __future__ import annotations

import importlib.util
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Callable, Optional

from django.conf import settings

from ..constant import TextExtractor
from . import llm, storage

logger = logging.getLogger(__name__)

OCR_CONCURRENCY = 4  # pages sent to the vision model at once
OCR_DPI = 150  # ~1275x1650 px for a letter page: legible, and few image tokens

PAGE_MARKER = "<!-- page:{} -->"
_PAGE_MARKER_RE = re.compile(r"<!-- page:(\d+) -->")
_FENCE_RE = re.compile(r"^```(?:markdown|md)?\s*\n(.*?)\n```\s*$", re.DOTALL)

ProgressCallback = Callable[[int, int], None]  # (pages done, total pages)

OCR_PROMPT = """You are transcribing one page of a scanned university administrative document \
(special orders, board resolutions, memoranda, travel orders).

Transcribe all of the page's content into clean Markdown, in reading order.
- Copy the wording exactly. Fix only obvious scanning noise in characters; never paraphrase, summarize or add anything.
- Ignore watermarks and stamps that are not part of the content, such as a diagonal "UNOFFICIAL COPY".
- Skip repeated letterhead contact details (street addresses, telephone and fax numbers, websites), but keep the issuing office's name.
- Keep names, numbers, dates and reference codes (e.g. "Special Order No. 01592-IIT, Series of 2023") exactly as printed.
- Use "##" for the document title or subject line, Markdown lists for enumerations and Markdown tables for tables.
- Write [illegible] for words you can't read and [signature] for signatures.
- If the page is blank, output exactly: [blank page]

Output only the transcription: no code fences, no commentary."""


class ExtractorUnavailable(RuntimeError):
    """The chosen extractor can't run in this deployment."""


@dataclass(frozen=True)
class Page:
    number: Optional[int]  # 1-based; None when the extractor can't tell pages apart
    text: str


def join_pages(pages: list[Page]) -> str:
    """Pages -> one Markdown string with page markers."""
    parts = []
    for page in pages:
        text = page.text.strip()
        if page.number is not None:
            parts.append(f"{PAGE_MARKER.format(page.number)}\n\n{text}")
        else:
            parts.append(text)
    return "\n\n".join(parts).strip()


def split_pages(markdown: str) -> list[Page]:
    """Inverse of join_pages; text before the first marker belongs to no page."""
    pages: list[Page] = []
    matches = list(_PAGE_MARKER_RE.finditer(markdown))
    if not matches:
        return [Page(None, markdown)] if markdown.strip() else []
    if markdown[: matches[0].start()].strip():
        pages.append(Page(None, markdown[: matches[0].start()]))
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        pages.append(Page(int(match.group(1)), markdown[match.end():end]))
    return pages


def has_content(pages: list[Page]) -> bool:
    return any(_clean_ocr(p.text) not in ("", "[blank page]") for p in pages)


def extract(pdf_path: Path, extractor: str, on_progress: Optional[ProgressCallback] = None) -> list[Page]:
    """Run `extractor` over the PDF; raises ValueError when no text comes out."""
    runners = {
        TextExtractor.VISION.value: _extract_vision,
        TextExtractor.MARKER.value: _extract_marker,
        TextExtractor.DOCLING.value: _extract_docling,
        TextExtractor.MARKITDOWN.value: _extract_markitdown,
    }
    runner = runners.get(extractor)
    if runner is None:
        raise ValueError(f"Unknown text extractor: {extractor!r}")
    pages = runner(pdf_path, on_progress)
    if not has_content(pages):
        hint = " It reads only the text layer; scanned PDFs need vision, marker or docling." if extractor == "markitdown" else ""
        raise ValueError(f"No text could be extracted with {extractor}.{hint}")
    return pages


# --- vision (OpenRouter) -------------------------------------------------------------
def _clean_ocr(text: str) -> str:
    text = text.strip()
    match = _FENCE_RE.match(text)
    return match.group(1).strip() if match else text


def _extract_vision(pdf_path: Path, on_progress: Optional[ProgressCallback]) -> list[Page]:
    if not llm.is_openrouter():
        raise ExtractorUnavailable("The vision extractor needs LLM_PROVIDER=openrouter.")
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(str(pdf_path))
    total = len(pdf)
    pdf.close()

    def transcribe(index: int) -> Page:
        image = storage.render_page(pdf_path, index, dpi=OCR_DPI)
        text = _clean_ocr(llm.transcribe_image(storage.image_bytes(image), OCR_PROMPT))
        return Page(index + 1, "" if text == "[blank page]" else text)

    pages: list[Page] = []
    if on_progress:
        on_progress(0, total)
    with ThreadPoolExecutor(max_workers=OCR_CONCURRENCY) as pool:
        for page in pool.map(transcribe, range(total)):  # map keeps page order
            pages.append(page)
            if on_progress:
                on_progress(len(pages), total)
    return pages


# --- local extractors (local-ocr image) ------------------------------------------
def _require(module: str, extractor: str):
    try:
        return __import__(module)
    except ImportError as e:
        raise ExtractorUnavailable(
            f"The {extractor} extractor isn't installed in this image; build it with LOCAL_OCR=1 "
            "(see README) or use the vision extractor."
        ) from e


@lru_cache(maxsize=1)
def _marker_converter():
    _require("marker", "marker")
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict

    config = ConfigParser({
        "output_format": "markdown",
        "disable_image_extraction": True,
        "force_ocr": True,
        "strip_existing_ocr": True,
        "paginate_output": True,
        "format_lines": True,
        "use_llm": False,
    })
    return PdfConverter(
        config=config.generate_config_dict(),
        artifact_dict=create_model_dict(),
        processor_list=config.get_processors(),
        renderer=config.get_renderer(),
    )


# marker (paginate_output=True) puts "{<0-based page>}" + 48 dashes before every page
_MARKER_PAGE_RE = re.compile(r"\n*\{(\d+)\}-{48}\n*")


def _extract_marker(pdf_path: Path, on_progress: Optional[ProgressCallback]) -> list[Page]:
    from marker.output import text_from_rendered

    text, _, _ = text_from_rendered(_marker_converter()(str(pdf_path)))
    parts = _MARKER_PAGE_RE.split(text)
    # split() yields [before, page0, text0, page1, text1, ...]
    pages = [Page(int(parts[i]) + 1, parts[i + 1]) for i in range(1, len(parts) - 1, 2)]
    return pages or [Page(None, text)]


@lru_cache(maxsize=1)
def _docling_converter():
    _require("docling", "docling")
    from docling.document_converter import DocumentConverter

    return DocumentConverter()


def _extract_docling(pdf_path: Path, on_progress: Optional[ProgressCallback]) -> list[Page]:
    document = _docling_converter().convert(str(pdf_path)).document
    return [Page(n, document.export_to_markdown(page_no=n)) for n in range(1, document.num_pages() + 1)]


@lru_cache(maxsize=1)
def _markitdown():
    _require("markitdown", "markitdown")
    from markitdown import MarkItDown

    return MarkItDown()


def _extract_markitdown(pdf_path: Path, on_progress: Optional[ProgressCallback]) -> list[Page]:
    text = _markitdown().convert(str(pdf_path)).text_content
    # pdfminer separates pages with form feeds
    return [Page(i + 1, part) for i, part in enumerate(text.split("\f")) if part.strip()]


def available_extractors() -> list[str]:
    """Extractors this deployment can run (shown in the upload dialog)."""
    names = [TextExtractor.VISION.value] if llm.is_openrouter() and settings.OCR_MODEL else []
    # find_spec checks installation without importing (marker/docling load torch)
    names += [name for name in ("marker", "docling", "markitdown") if importlib.util.find_spec(name)]
    return names
