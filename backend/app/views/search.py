"""Search page API.

GET  /api/search/?q=...         hybrid search, grouped by document (no LLM call, fast)
POST /api/search/answer/        a short cited answer from the top passages (one LLM call)

Splitting them lets the results render immediately while the answer is written.
"""
import logging
import re
import time

from langchain_core.messages import HumanMessage, SystemMessage
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..constant import UsageKind
from ..constant.prompts import SEARCH_ANSWER_PROMPT
from ..serializers import DocumentSerializer
from ..services import llm, quotas, search
from ..services.agent import text_of
from ..services.errors import describe_error
from ..utils.permissions import IsAuthenticated
from .documents import _csv_ints

logger = logging.getLogger(__name__)

SEARCH_K = 12
ANSWER_K = 6
_QUESTION_RE = re.compile(
    r"\?\s*$|^(who|what|when|where|why|how|which|is|are|was|were|can|could|does|do|did|should|ano|sino|kailan|saan|paano|bakit)\b",
    re.IGNORECASE,
)


def looks_like_question(query: str) -> bool:
    """Questions get an AI answer above the results; keyword searches don't."""
    return bool(_QUESTION_RE.search(query.strip()))


def _filters(request) -> dict:
    params = request.query_params if request.method == "GET" else request.data
    return {
        "years": _csv_ints(str(params.get("year", ""))),
        "tag_ids": _csv_ints(str(params.get("tags", ""))),
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_documents(request):
    query = request.query_params.get("q", "").strip()
    if not query:
        return Response({"detail": "Type something to search for."}, status=status.HTTP_400_BAD_REQUEST)

    started = time.perf_counter()
    try:
        hits = search.search(query, request.user, k=SEARCH_K, **_filters(request))
    except Exception as error:
        logger.exception("Search failed")
        return Response({"detail": describe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)

    groups: dict[int, dict] = {}
    for hit in hits:
        group = groups.get(hit.document.id)
        if group is None:
            group = groups[hit.document.id] = {
                "document": DocumentSerializer(hit.document, context={"request": request}).data,
                "score": hit.score,
                "passages": [],
            }
        group["passages"].append({
            "chunk_id": hit.chunk.id,
            "page": hit.chunk.page,
            "section": hit.chunk.section,
            "text": hit.chunk.text,
            "matched": [leg for leg in ("vector", "keyword") if leg in hit.ranks],
        })
    return Response({
        "query": query,
        "is_question": looks_like_question(query),
        "results": list(groups.values()),
        "took_ms": round((time.perf_counter() - started) * 1000),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def search_answer(request):
    query = str(request.data.get("q", "")).strip()
    if not query:
        return Response({"detail": "Ask a question."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        quotas.check_message(request.user)
    except quotas.QuotaExceeded as e:
        return Response({"detail": e.message, "code": e.code}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    try:
        hits = search.search(query, request.user, k=ANSWER_K, **_filters(request))
        if not hits:
            return Response({"answer": "", "citations": []})
        quotas.record(request.user, UsageKind.MESSAGE)
        passages = "\n\n".join(
            f"[{i}] {hit.document.title}" + (f", p. {hit.chunk.page}" if hit.chunk.page else "") + f"\n{hit.chunk.text}"
            for i, hit in enumerate(hits, start=1)
        )
        reply = llm.get_chat_model(temperature=0.1, max_tokens=500).invoke([
            SystemMessage(SEARCH_ANSWER_PROMPT.format(passages=passages)),
            HumanMessage(query),
        ])
    except Exception as error:
        logger.exception("Search answer failed")
        return Response({"detail": describe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        "answer": text_of(reply).strip(),
        # Citation [n] refers to the n-th passage
        "citations": [
            {"n": i, "document_id": hit.document.id, "title": hit.document.title, "page": hit.chunk.page}
            for i, hit in enumerate(hits, start=1)
        ],
    })
