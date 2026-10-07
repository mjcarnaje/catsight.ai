"""Catalogue a document: title, summary, reference number, date, tags, questions.

Most administrative documents fit in one model call, so the common path is a
single structured request over the full text. Only text too long for the
model's context window is summarized section by section first (map), and the
section notes are what the final call reads (reduce).
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Optional

from django.conf import settings
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field

from ..constant.prompts import ANALYSIS_PROMPT, SECTION_NOTES_PROMPT
from ..models import Tag
from . import llm

logger = logging.getLogger(__name__)

# Characters of text one call may read. Hosted models take ~1M tokens; Ollama is
# limited by OLLAMA_NUM_CTX (8k tokens ~ 20k characters, minus prompt and answer).
SINGLE_PASS_CHARS = {"openrouter": 300_000, "ollama": 14_000}
SECTION_CHARS = {"openrouter": 60_000, "ollama": 6_000}
OPENING_CHARS = 4_000  # the first page or so: letterhead, subject, reference number
MAP_CONCURRENCY = 4

_PAGE_MARKER_RE = re.compile(r"<!-- page:(\d+) -->")


class DocumentAnalysis(BaseModel):
    # Every field is required (nullable where it may be absent): with strict JSON
    # schemas, optional fields are the ones small models silently skip.
    title: str = Field(description="The subject line verbatim if there is one, else a concise Title Case title (max 12 words).")
    summary: str = Field(description="Markdown summary: what the document does and its key details.")
    reference_number: Optional[str] = Field(description="Reference as printed, e.g. 'Special Order No. 01592-IIT, Series of 2023'; null if none.")
    issued_on: Optional[str] = Field(description="Issuance date as YYYY-MM-DD; null if not stated.")
    year: Optional[int] = Field(description="Four-digit issuance year; null if not stated.")
    tags: list[str] = Field(description="1-3 tag names copied exactly from the allowed list.")
    questions: list[str] = Field(description="Two short questions a reader could ask that this document answers.")


def _budget(table: dict[str, int]) -> int:
    return table.get(settings.LLM_PROVIDER, min(table.values()))


def _plain(markdown: str) -> str:
    """Page markers mean nothing to the model; show them as readable page breaks."""
    return _PAGE_MARKER_RE.sub(lambda m: f"[Page {m.group(1)}]", markdown)


def _section_notes(text: str, model: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=_budget(SECTION_CHARS), chunk_overlap=200)
    sections = splitter.split_text(text)
    chat = llm.get_chat_model(model, max_tokens=1200)

    def notes(section: str) -> str:
        reply = chat.invoke([SystemMessage(SECTION_NOTES_PROMPT), HumanMessage(section)])
        return str(reply.content).strip()

    with ThreadPoolExecutor(max_workers=MAP_CONCURRENCY) as pool:
        result = list(pool.map(notes, sections))
    logger.info(f"Summarized {len(sections)} sections")
    return result


def _reduce_notes(notes: list[str], model: str, max_rounds: int = 3) -> list[str]:
    """Summarize the notes themselves until together they fit one call."""
    budget = _budget(SINGLE_PASS_CHARS) - OPENING_CHARS
    for _ in range(max_rounds):
        if sum(len(n) for n in notes) <= budget or len(notes) <= 1:
            break
        notes = _section_notes("\n\n".join(notes), model)
    return notes


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def _plausible_year(year: Optional[int]) -> Optional[int]:
    # Models sometimes return 0 or a page number instead of null
    return year if year is not None and 1900 <= year <= date.today().year + 1 else None


def analyze(markdown: str, model: Optional[str] = None) -> dict:
    """Catalogue fields for a document's extracted Markdown.

    Returns title, summary, reference_number, issued_on (date | None), year,
    tag_ids (existing tags only) and questions.
    """
    model = model or settings.CHAT_MODEL
    text = _plain(markdown).strip()
    if not text:
        raise ValueError("The document has no text to summarize.")

    if len(text) <= _budget(SINGLE_PASS_CHARS):
        material = f"Full text:\n\n{text}"
    else:
        notes = _reduce_notes(_section_notes(text, model), model)
        material = (
            f"Opening of the document:\n\n{text[:OPENING_CHARS]}\n\n"
            "Notes on the whole document, section by section:\n\n" + "\n\n---\n\n".join(notes)
        )

    tags = {name.lower(): (tag_id, name) for tag_id, name in Tag.objects.values_list("id", "name")}
    tag_lines = "\n".join(
        f"- {name}: {description or ''}".rstrip(": ")
        for name, description in Tag.objects.values_list("name", "description")
    )
    chain = llm.structured(llm.get_chat_model(model, max_tokens=2000), DocumentAnalysis)
    result: DocumentAnalysis = chain.invoke([
        SystemMessage(ANALYSIS_PROMPT.format(tags=tag_lines)),
        HumanMessage(material),
    ])

    issued_on = _parse_date(result.issued_on)
    year = _plausible_year(result.year or (issued_on.year if issued_on else None))
    # Keep only tags that exist (case-insensitive); models paraphrase names
    tag_ids = list(dict.fromkeys(tags[t.strip().lower()][0] for t in result.tags if t.strip().lower() in tags))
    analysis = {
        "title": result.title.strip().strip('"')[:300],
        "summary": result.summary.strip(),
        "reference_number": (result.reference_number or "").strip()[:255],
        "issued_on": issued_on,
        "year": year,
        "tag_ids": tag_ids,
        "questions": [q.strip() for q in result.questions if q.strip()][:3],
    }
    logger.info(f"Analysis: {analysis['title']!r} ref={analysis['reference_number']!r} year={year} tags={result.tags}")
    return analysis
