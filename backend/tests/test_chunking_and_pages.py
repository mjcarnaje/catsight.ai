from app.services.extraction import Page, _clean_ocr, has_content, join_pages, split_pages
from app.utils.chunking import split_markdown


def test_pages_round_trip_through_markers():
    pages = [Page(1, "## Special Order\n\nFirst page."), Page(2, "Second page.")]
    assert [(p.number, p.text.strip()) for p in split_pages(join_pages(pages))] == [
        (1, "## Special Order\n\nFirst page."),
        (2, "Second page."),
    ]


def test_chunks_know_their_page_and_section():
    markdown = join_pages([
        Page(1, "## Designation of Director\n\nProf. A is designated Director of MICeL."),
        Page(2, "## Effectivity\n\nThis order takes effect immediately."),
    ])
    chunks = split_markdown(markdown)
    assert [(c.page, c.section) for c in chunks] == [(1, "Designation of Director"), (2, "Effectivity")]
    assert "<!-- page" not in "".join(c.text for c in chunks)
    assert chunks[1].text.startswith("## Effectivity")


def test_ocr_output_cleanup():
    assert _clean_ocr("```markdown\n## Title\n\nBody\n```") == "## Title\n\nBody"
    assert not has_content([Page(1, "[blank page]"), Page(2, "  ")])
    assert has_content([Page(1, "Text")])
