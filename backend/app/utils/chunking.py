"""Markdown-aware chunking that remembers where each chunk came from.

Every chunk carries the page it starts on (from the `<!-- page:N -->` markers
the extractors write) and the heading path above it, so answers can cite
"Eligibility > Requirements, p. 3" and the markers never end up inside search results.
"""
import bisect
import re
from dataclasses import dataclass
from typing import Optional

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150

# Written by services/extraction.join_pages (page numbers are 1-based)
_PAGE_MARKER = re.compile(r"\s*<!-- page:(\d+) -->\s*")
_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$", re.MULTILINE)

# Markdown-aware separators: prefers splitting at headings, then paragraphs, then lines
_splitter = RecursiveCharacterTextSplitter.from_language(
    Language.MARKDOWN,
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    add_start_index=True,
)


@dataclass
class Chunk:
    text: str
    page: Optional[int]  # 1-based; None when the converter doesn't mark pages
    section: Optional[str]  # e.g. "Scholarship Guidelines > Eligibility"


def _strip_page_markers(text: str) -> tuple[str, list[int], list[int]]:
    """Remove page separators; return the clean text plus where each page starts in it."""
    parts, page_starts, page_numbers = [], [], []
    clean_len = last = 0
    for m in _PAGE_MARKER.finditer(text):
        before = text[last:m.start()]
        if before:
            before += "\n\n"  # keep paragraphs on either side of the break separated
        parts.append(before)
        clean_len += len(before)
        page_starts.append(clean_len)
        page_numbers.append(int(m.group(1)))
        last = m.end()
    parts.append(text[last:])
    return "".join(parts), page_starts, page_numbers


@dataclass
class _Section:
    heading: str  # the heading line itself, "" for text before the first heading
    path: Optional[str]
    body_start: int  # offset of the body (after the heading line) in the clean text
    body: str


def _sections(text: str) -> list[_Section]:
    """Split at every heading; each section knows its full path ("Parent > Child")."""
    matches = list(_HEADING.finditer(text))
    sections = [_Section("", None, 0, text[: matches[0].start() if matches else len(text)])]
    stack: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        level, title = len(m.group(1)), m.group(2).strip("* ")
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, title))
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append(
            _Section(m.group(0).strip(), " > ".join(t for _, t in stack)[:200], m.end(), text[m.end():end])
        )
    return sections


def _value_at(offsets: list[int], values: list, pos: int):
    """Value of the last entry starting at or before `pos`."""
    i = bisect.bisect_right(offsets, pos) - 1
    return values[i] if i >= 0 else None


def split_markdown(text: str) -> list[Chunk]:
    """Chunk per section so a chunk never spans two headings.

    Every chunk starts with its section heading, which gives the embedding
    context and avoids heading-only chunks. Headings of empty sections (a
    title directly followed by a subtitle) are carried into the next chunk.
    """
    clean, page_starts, page_numbers = _strip_page_markers(text)

    chunks: list[Chunk] = []
    carried_headings = ""
    for section in _sections(clean):
        if not section.body.strip():
            carried_headings += section.heading + "\n\n"
            continue
        prefix = (carried_headings + section.heading).strip()
        carried_headings = ""
        for doc in _splitter.create_documents([section.body]):
            start = section.body_start + doc.metadata.get("start_index", 0)
            chunks.append(
                Chunk(
                    text=f"{prefix}\n\n{doc.page_content}" if prefix else doc.page_content,
                    page=_value_at(page_starts, page_numbers, start),
                    section=section.path,
                )
            )
    return chunks
