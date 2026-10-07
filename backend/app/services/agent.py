"""CATSight chat agent (LangGraph, persisted in Postgres).

    START ─► assistant ─┬─► tools ─► assistant      search_documents, at most MAX_SEARCHES_PER_TURN
                        ├─► generate_title ─► END  once, after a new chat's first answer
                        └─► END

Only the assistant node's tokens are streamed to the user (views/chat.py).
Sources are numbered per answer: a document keeps its number across the
searches of one turn, so the model's [n] citations always point at the same
document in the UI.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import date
from functools import lru_cache
from typing import Annotated, Any, Literal

from django.conf import settings
from django.db import close_old_connections
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import InjectedState, ToolNode
from psycopg_pool import ConnectionPool
from typing_extensions import TypedDict

from ..constant.prompts import AGENT_PROMPT, AGENT_SCOPE_PROMPT, TITLE_PROMPT
from ..models import Document, DocumentChunk, User
from . import llm, search

logger = logging.getLogger(__name__)

RETRIEVE_K = 6  # passages per search
# A chat limited to one document this short reads it whole instead of searching it:
# a search can miss the passage that answers (a table of rates worded unlike the question)
FULL_DOCUMENT_CHARS = 60_000
MAX_SEARCHES_PER_TURN = 3
HISTORY_MESSAGES = 12  # earlier questions + answers kept in the model's context
ANSWER_TEMPERATURE = 0.2
ANSWER_MAX_TOKENS = 1500
CHECKPOINTER_SETUP_LOCK_ID = 7_412_001  # app-wide key for pg_advisory_lock


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    title: str
    document_ids: list[int]


# --- Message helpers ------------------------------------------------------------------
def text_of(message: AnyMessage) -> str:
    content = message.content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return content or ""


def current_turn(messages: list[AnyMessage]) -> list[AnyMessage]:
    """Messages after the latest question."""
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], HumanMessage):
            return messages[i + 1:]
    return messages


def merge_sources(tool_messages: list[ToolMessage]) -> list[dict[str, Any]]:
    """Sources of several searches, one entry per document, ordered by citation number."""
    by_document: dict[int, dict[str, Any]] = {}
    next_n = 1
    for message in tool_messages:
        for source in message.artifact or []:
            if not isinstance(source, dict) or "id" not in source:
                continue
            entry = by_document.get(source["id"])
            if entry is None:
                # Chats saved before numbering existed have no "n"
                entry = {**source, "n": source.get("n") or next_n, "passages": []}
                by_document[source["id"]] = entry
            seen = {p.get("chunk_id") for p in entry["passages"]}
            entry["passages"] += [p for p in source.get("passages", []) if p.get("chunk_id") not in seen]
            next_n = max(next_n, entry["n"] + 1)
    return sorted(by_document.values(), key=lambda s: s["n"])


def _source(document: Document, n: int) -> dict[str, Any]:
    return {
        "n": n,
        "id": document.id,
        "title": document.title or document.file_name,
        "reference_number": document.reference_number,
        "year": document.year,
        "file_name": document.file_name,
        "preview_image": document.preview_image,
        "page_count": document.page_count,
        "passages": [],
    }


def _format_for_model(sources: list[dict[str, Any]]) -> str:
    blocks = []
    for source in sources:
        heading = f"[{source['n']}] {source['title']}"
        details = ", ".join(str(x) for x in (source["reference_number"], source["year"]) if x)
        lines = [f"{heading} ({details})" if details else heading]
        for passage in source["passages"]:
            where = ", ".join(filter(None, [passage["section"], f"p. {passage['page']}" if passage["page"] else None]))
            lines.append(f"— {where}:\n{passage['text']}" if where else f"— {passage['text']}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


# --- Tool ---------------------------------------------------------------------------------
@tool(response_format="content_and_artifact")
def search_documents(
    query: str,
    state: Annotated[dict, InjectedState],
    config: RunnableConfig,
) -> tuple[str, list[dict[str, Any]]]:
    """Search MSU-IIT's administrative documents for passages relevant to a question.

    Args:
        query: What to look for: names, reference numbers, topics, e.g. "travel order Zamboanga 2022".
    """
    try:
        user = User.objects.get(pk=config["configurable"]["user_id"])
        scope = state.get("document_ids") or None
        hits = _whole_document(user, scope) if scope and len(scope) == 1 else None
        if hits is None:
            # Within a chosen scope, don't cap a document at the usual three passages
            per_document = RETRIEVE_K if scope else search.MAX_PER_DOCUMENT
            hits = search.search(query, user, k=RETRIEVE_K, document_ids=scope, per_document=per_document)

        earlier = merge_sources([m for m in current_turn(state["messages"]) if isinstance(m, ToolMessage)])
        numbers = {s["id"]: s["n"] for s in earlier}
        next_n = max(numbers.values(), default=0) + 1

        sources: dict[int, dict[str, Any]] = {}
        for hit in hits:
            document = hit.document
            if document.id not in sources:
                if document.id not in numbers:
                    numbers[document.id] = next_n
                    next_n += 1
                sources[document.id] = _source(document, numbers[document.id])
            sources[document.id]["passages"].append({
                "chunk_id": hit.chunk.id,
                "page": hit.chunk.page,
                "section": hit.chunk.section,
                "text": hit.chunk.text,
            })
    finally:
        close_old_connections()  # tools run on worker threads with their own DB connections

    if not sources:
        return "No passages matched this search.", []
    ordered = sorted(sources.values(), key=lambda s: s["n"])
    return _format_for_model(ordered), ordered


def _whole_document(user: User, document_ids: list[int]) -> list[search.Hit] | None:
    """Every passage of the one scoped document, in reading order, if it's short enough."""
    documents = search.searchable_documents(user, document_ids)
    chunks = list(DocumentChunk.objects.filter(document__in=documents).select_related("document").order_by("index"))
    if not chunks or sum(len(c.text) for c in chunks) > FULL_DOCUMENT_CHARS:
        return None
    return [search.Hit(chunk) for chunk in chunks]


# --- Nodes ---------------------------------------------------------------------------------
def _model_context(messages: list[AnyMessage]) -> list[AnyMessage]:
    """Earlier questions and final answers, plus everything in the current turn.

    Earlier turns' search calls and results are left out: the answers already
    carry what mattered, and the raw passages would multiply the prompt size.
    """
    last_question = max((i for i, m in enumerate(messages) if isinstance(m, HumanMessage)), default=0)
    history = [
        m for m in messages[:last_question]
        if isinstance(m, HumanMessage) or (isinstance(m, AIMessage) and not m.tool_calls and text_of(m))
    ][-HISTORY_MESSAGES:]
    while history and not isinstance(history[0], HumanMessage):
        history.pop(0)  # providers expect the conversation to open with the user
    return history + messages[last_question:]


def _scope_prompt(document_ids: list[int]) -> str:
    if not document_ids:
        return ""
    titles = Document.objects.filter(id__in=document_ids).values_list("title", "file_name")
    return AGENT_SCOPE_PROMPT.format(documents="\n".join(f"  - {t or f}" for t, f in titles))


_GREETING_RE = re.compile(r"^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|salamat|ok|okay)\b")
_ABOUT_ME_RE = re.compile(r"^(who are you|what can you do|what do you do)\b")


def needs_search(question: str) -> bool:
    """Everything but a short greeting, thanks or question about the assistant itself."""
    text = question.strip().lower()
    if len(text.split()) > 6:
        return True
    if _ABOUT_ME_RE.match(text):
        return False
    return "?" in text or not _GREETING_RE.match(text)


def assistant(state: State, config: RunnableConfig) -> dict:
    configurable = config.get("configurable", {})
    turn = current_turn(state["messages"])
    searches = sum(len(m.tool_calls) for m in turn if isinstance(m, AIMessage))
    question = next((text_of(m) for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), "")

    model = llm.get_chat_model(
        configurable.get("model") or settings.CHAT_MODEL,
        temperature=ANSWER_TEMPERATURE,
        max_tokens=ANSWER_MAX_TOKENS,
    )
    if searches < MAX_SEARCHES_PER_TURN:
        # The first step of a question must search: left to choose, models answer
        # follow-ups from the conversation, where earlier passages are no longer shown
        force = searches == 0 and needs_search(question)
        model = model.bind_tools([search_documents], tool_choice="search_documents" if force else None)

    system = SystemMessage(AGENT_PROMPT.format(
        scope=_scope_prompt(state.get("document_ids") or []),
        today=date.today().isoformat(),
    ))
    messages = [system, *_model_context(state["messages"])]
    for _ in range(2):
        result = model.invoke(messages)
        if result.tool_calls or text_of(result).strip():
            return {"messages": [result]}
        # Small models occasionally return nothing; nudge once (the nudge isn't saved)
        messages = messages + [HumanMessage("Please answer the question.")]
    logger.warning("The model returned an empty answer twice")
    return {"messages": [AIMessage("Sorry, I couldn't put an answer together just now. Please try again.")]}


def generate_title(state: State) -> dict:
    """Name the chat after its first question; falls back to the question itself."""
    question = next((text_of(m) for m in state["messages"] if isinstance(m, HumanMessage)), "")
    title = ""
    try:
        reply = llm.get_fast_model().invoke([SystemMessage(TITLE_PROMPT), HumanMessage(question)])
        title = text_of(reply).strip().strip('"').strip()
    except Exception:
        logger.warning("Chat title generation failed; using the question instead", exc_info=True)
    if not title or len(title) > 80:
        title = question.strip()[:60]
    return {"title": title or "New chat"}


def route_after_assistant(state: State) -> Literal["tools", "generate_title", "__end__"]:
    messages = state["messages"]
    if not messages:  # every message was removed (the first question was edited)
        return END
    if getattr(messages[-1], "tool_calls", None):
        return "tools"
    if not state.get("title"):
        return "generate_title"
    return END


# --- Graph ---------------------------------------------------------------------------------
def _psycopg_uri() -> str:
    db = settings.DATABASES["default"]
    return f"postgresql://{db['USER']}:{db['PASSWORD']}@{db['HOST']}:{db['PORT']}/{db['NAME']}"


@lru_cache(maxsize=1)
def get_checkpointer() -> PostgresSaver:
    pool = ConnectionPool(
        conninfo=_psycopg_uri(),
        max_size=10,
        kwargs={"autocommit": True, "application_name": "catsight_agent"},
        open=True,
    )
    checkpointer = PostgresSaver(pool)
    # Web workers and Celery start together; on a fresh database their setup()
    # calls race to create the same tables. Take turns via an advisory lock, polled
    # because setup() runs CREATE INDEX CONCURRENTLY, which would wait on a blocked
    # pg_advisory_lock call and deadlock.
    with pool.connection() as conn:
        while not conn.execute("SELECT pg_try_advisory_lock(%s)", (CHECKPOINTER_SETUP_LOCK_ID,)).fetchone()[0]:
            time.sleep(0.5)
        try:
            checkpointer.setup()
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (CHECKPOINTER_SETUP_LOCK_ID,))
    return checkpointer


def build_graph(checkpointer):
    builder = StateGraph(State)
    builder.add_node("assistant", assistant)
    # Tool errors go back to the model as a ToolMessage so it can recover
    builder.add_node("tools", ToolNode([search_documents], handle_tool_errors=True))
    builder.add_node("generate_title", generate_title)
    builder.add_edge(START, "assistant")
    builder.add_conditional_edges("assistant", route_after_assistant, ["tools", "generate_title", END])
    builder.add_edge("tools", "assistant")
    builder.add_edge("generate_title", END)
    return builder.compile(checkpointer=checkpointer)


@lru_cache(maxsize=1)
def get_agent():
    """The compiled graph (built on first use, so imports never touch the database)."""
    return build_graph(get_checkpointer())
