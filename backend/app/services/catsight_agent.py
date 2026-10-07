"""CATSight chat agent (LangGraph, persisted in Postgres).

    START ─► assistant ─┬─► tools ─► assistant      search the document repository
                        ├─► generate_title ─► END  once, after a new chat's first answer
                        └─► END

The assistant node is the only one whose tokens are streamed to the user
(see chat_with_docs in views/documents.py).
"""
import logging
import time
from datetime import date
from typing import Annotated, Any, Literal, Optional

import httpx
from django.conf import settings
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import InjectedState, ToolNode
from langgraph.types import RetryPolicy
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
from typing_extensions import TypedDict

from ..constant.prompts import CATSIGHT_PROMPT, TITLE_GENERATION_PROMPT
from ..services.postgres import get_psycopg_connection_string
from ..services.vectorstore import DB_URI, search_chunks
from .sources import format_sources_for_llm, sources_from_chunks
from .ollama import FAST_NUM_CTX, get_chat_model

logger = logging.getLogger(__name__)

CONNECTION_KWARGS = {
    "application_name": "langgraph_app",
    "autocommit": True,
}

PSYCOPG_DB_URI = get_psycopg_connection_string(DB_URI)

_connection_pool = None

# Arbitrary app-wide key for pg_advisory_lock around checkpointer.setup()
CHECKPOINTER_SETUP_LOCK_ID = 7_412_001

ASSISTANT_TEMPERATURE = 0.3  # grounded answers; higher invents details
MAX_EMPTY_RETRIES = 2  # small models occasionally return an empty message
RETRIEVE_K = 6  # passages handed to the model per search

# Retry only when Ollama is unreachable or slow, not on errors like "model not found"
OLLAMA_RETRY = RetryPolicy(max_attempts=3, initial_interval=1.0, retry_on=(httpx.TransportError, ConnectionError))


def get_connection_pool():
    """Get or initialize the connection pool"""
    global _connection_pool

    if _connection_pool is None:
        _connection_pool = ConnectionPool(
            conninfo=PSYCOPG_DB_URI,
            max_size=20,
            kwargs=CONNECTION_KWARGS,
            open=True,
        )
        # Log the host/database only; the URI contains the password
        logger.info(f"Created PostgreSQL connection pool for LangGraph on {PSYCOPG_DB_URI.rsplit('@', 1)[-1]}")
    return _connection_pool


# --- State -------------------------------------------------------------------
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    title: Optional[str]
    should_generate_title: bool
    file_ids: Optional[list[int]]


class Title(BaseModel):
    title: str


# --- Retrieval tool ------------------------------------------------------------
@tool(parse_docstring=True, response_format="content_and_artifact")
def retrieve(query: str, state: Annotated[dict, InjectedState]) -> tuple[str, list[dict[str, Any]]]:
    """Search MSU-IIT's document repository for passages relevant to a question.

    Args:
        query: The substance of what to look for, e.g. "tuition refund deadline".
    """
    file_ids = state.get("file_ids") or []
    chunks = search_chunks(
        query,
        k=RETRIEVE_K,
        filter={"doc_id": {"$in": file_ids}} if file_ids else None,
    )
    sources = sources_from_chunks(chunks)
    if not sources:
        return "No relevant passages were found in the document repository.", []
    # The text goes to the model; the full source list is attached for the UI
    return format_sources_for_llm(sources), sources


# --- Nodes -------------------------------------------------------------------
assistant_prompt = ChatPromptTemplate.from_messages([
    ("system", CATSIGHT_PROMPT),
    ("placeholder", "{messages}"),
])

title_prompt = ChatPromptTemplate.from_messages([
    ("system", TITLE_GENERATION_PROMPT),
    ("human", "{text}"),
])


def _has_text(message: AIMessage) -> bool:
    content = message.content
    if isinstance(content, list):
        return any(isinstance(part, dict) and part.get("text") for part in content)
    return bool(content and content.strip())


def assistant(state: State, config: RunnableConfig) -> dict:
    model = config.get("configurable", {}).get("model") or settings.CHAT_MODEL
    chain = assistant_prompt | get_chat_model(model, temperature=ASSISTANT_TEMPERATURE).bind_tools([retrieve])

    messages = state["messages"]
    for _ in range(MAX_EMPTY_RETRIES + 1):
        result = chain.invoke({"messages": messages, "today_date": date.today().isoformat()})
        if result.tool_calls or _has_text(result):
            return {"messages": [result]}
        # Nudge locally only; the nudge is never saved to the conversation
        messages = messages + [HumanMessage("Respond with a real answer.")]

    logger.warning(f"{model} returned empty responses {MAX_EMPTY_RETRIES + 1} times")
    return {"messages": [AIMessage("Sorry, I couldn't put an answer together just now. Please try asking again.")]}


def generate_title(state: State) -> dict:
    """Name the chat from the user's questions; falls back to the first question."""
    questions = [m.content for m in state["messages"] if isinstance(m, HumanMessage)]
    title = ""
    try:
        chain = title_prompt | get_chat_model(settings.FAST_MODEL, num_ctx=FAST_NUM_CTX).with_structured_output(Title)
        title = chain.invoke({"text": "\n".join(questions)}).title.strip().strip('"')
    except Exception:
        logger.exception("Chat title generation failed; using the first question instead")
    if not title and questions:
        title = questions[0].strip()[:60]
    logger.info(f"Generated title: {title}")
    return {"title": title[:100] or "New Chat", "should_generate_title": False}


def route_after_assistant(state: State) -> Literal["tools", "generate_title", "__end__"]:
    """One router, so title generation never runs in parallel with a tool call."""
    if state["messages"][-1].tool_calls:
        return "tools"
    if not state.get("title") and state.get("should_generate_title", True):
        return "generate_title"
    return END


# --- Graph -------------------------------------------------------------------
def _setup_checkpointer(pool: ConnectionPool) -> PostgresSaver:
    checkpointer = PostgresSaver(pool)
    # backend, celery_worker, jupyter and manage.py all import this module at startup;
    # on a fresh DB their concurrent setup() calls race to create the same tables.
    # A Postgres advisory lock makes them take turns (setup() itself is idempotent).
    # Poll with pg_try_advisory_lock rather than blocking in pg_advisory_lock: setup()
    # runs CREATE INDEX CONCURRENTLY, which waits for every in-flight query, including
    # a blocked lock call, so a blocking wait would deadlock.
    with pool.connection() as lock_conn:
        while not lock_conn.execute(
            "SELECT pg_try_advisory_lock(%s)", (CHECKPOINTER_SETUP_LOCK_ID,)
        ).fetchone()[0]:
            time.sleep(0.5)
        try:
            checkpointer.setup()
        finally:
            lock_conn.execute("SELECT pg_advisory_unlock(%s)", (CHECKPOINTER_SETUP_LOCK_ID,))
    logger.info("PostgreSQL checkpointer setup completed")
    return checkpointer


def create_catsight_agent():
    """Compile the chat graph with Postgres persistence."""
    builder = StateGraph(State)
    builder.add_node("assistant", assistant, retry_policy=OLLAMA_RETRY)
    # Tool errors come back to the model as a ToolMessage so it can recover
    builder.add_node("tools", ToolNode([retrieve], handle_tool_errors=True))
    builder.add_node("generate_title", generate_title)

    builder.add_edge(START, "assistant")
    builder.add_conditional_edges("assistant", route_after_assistant, ["tools", "generate_title", END])
    builder.add_edge("tools", "assistant")
    builder.add_edge("generate_title", END)

    return builder.compile(checkpointer=_setup_checkpointer(get_connection_pool()))


catsight_agent = create_catsight_agent()
