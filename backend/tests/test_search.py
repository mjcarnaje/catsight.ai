import pytest

from app.constant import DocumentStatus
from app.models import Document, Tag
from app.services import indexing, search
from app.services.extraction import Page, join_pages


def ready_document(user, title, text, year=None, reference="", private=False, tags=()):
    document = Document.objects.create(
        title=title, reference_number=reference, year=year, uploaded_by=user, is_private=private,
        status=DocumentStatus.READY.value, file="x.pdf", page_count=1,
    )
    document.tags.set(tags)
    document.chunk_count = indexing.index_document(document, join_pages([Page(1, text)]))
    document.save()
    return document


def test_keyword_terms_split_identifiers_and_drop_leading_zeros():
    assert search.keyword_terms("SO 01592-2023, Vilela-Malabanan") == ["so", "1592", "2023", "vilela", "malabanan"]


def test_rrf_rewards_agreement_between_legs():
    fused = search.fuse({"vector": [(1, 0.9), (2, 0.8)], "keyword": [(2, 3.0), (3, 1.0)]})
    assert [chunk_id for chunk_id, _, _ in fused] == [2, 1, 3]
    assert fused[0][2] == {"vector": 2, "keyword": 1}


@pytest.mark.django_db
def test_exact_reference_number_is_found_with_or_without_leading_zeros(admin):
    target = ready_document(
        admin, "Charter Day Committees", "Special Order No. 01592-IIT, Series of 2023. Committees for the Charter Day celebration.",
        year=2023, reference="Special Order No. 01592-IIT, Series of 2023",
    )
    ready_document(admin, "Travel to Zamboanga", "Faculty members may travel to Zamboanga del Norte for research.", year=2022)

    for query in ("SO 01592-2023", "special order 1592"):
        hits = search.search(query, admin, k=3)
        assert hits[0].document == target, query
        assert "keyword" in hits[0].ranks


@pytest.mark.django_db
def test_private_documents_are_only_searchable_by_their_owner(admin, member, guest):
    private = ready_document(guest, "My Notes", "zamboanga field trip permission notes", private=True)
    ready_document(admin, "Library Doc", "library document about enrollment")

    assert private not in [h.document for h in search.search("zamboanga field trip", member)]
    assert private in [h.document for h in search.search("zamboanga field trip", guest)]
    assert private in [h.document for h in search.search("zamboanga field trip", admin)]


@pytest.mark.django_db
def test_filters_and_per_document_cap(admin):
    tag = Tag.objects.create(name="Incentive-test")
    long_text = "\n\n".join(f"## Part {i}\n\ncash incentive for paper presentation number {i}" for i in range(8))
    incentive = ready_document(admin, "Incentives", long_text, year=2017, tags=[tag])
    ready_document(admin, "Other incentive", "cash incentive for a poster", year=2023)

    hits = search.search("cash incentive paper presentation", admin, k=10)
    assert sum(1 for h in hits if h.document == incentive) <= search.MAX_PER_DOCUMENT

    only_2017 = search.search("cash incentive", admin, years=[2017])
    assert {h.document for h in only_2017} == {incentive}
    assert {h.document for h in search.search("cash incentive", admin, tag_ids=[tag.id])} == {incentive}


@pytest.mark.django_db
def test_unrelated_query_returns_nothing(admin, settings):
    settings.RETRIEVAL_MIN_SIMILARITY = 0.3
    ready_document(admin, "Designation", "Prof. A is designated Director of the Center for eLearning.")
    assert search.search("basketball tournament schedule", admin) == []
