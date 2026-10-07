"""Search-page agent: find documents and, for questions, write a short answer.

    START ─┬─► retrieve_documents ─► format_sources ─┐
           └─► check_should_summarize ───────────────┴─► (sources and a question?) ─► generate_summary ─► END

The "is this a question?" check runs in parallel with retrieval instead of
after it, so it no longer adds an LLM round-trip to every search.
"""
import logging
from typing import Any, Dict, List

from django.conf import settings
from langchain_core.documents import Document as Doc
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel
from typing_extensions import TypedDict

from ..constant.prompts import SUMMARIZER_PROMPT
from .ollama import FAST_NUM_CTX, get_chat_model
from .sources import sources_from_chunks
from .vectorstore import search_chunks

logger = logging.getLogger(__name__)

SEARCH_K = 10  # passages per search; grouped into documents for the results page


class State(TypedDict):
    is_accurate: bool
    should_answer: bool
    query: str
    documents: List[Doc]
    sources: List[Dict[str, Any]]
    summary: str
    years: List[str]
    tags: List[str]


class ShouldAnswerSchema(BaseModel):
    should_answer: bool


def retrieve(state: State):
    """Relevant passages for the query, narrowed by the selected years and tags."""
    filters = {}
    if state.get("years"):
        filters["year"] = {"$in": state["years"]}
    if state.get("tags"):
        filters["tags"] = {"$in": state["tags"]}

    return {"documents": search_chunks(state["query"], k=SEARCH_K, filter=filters or None)}


def transform_documents(state: State):
    return {"sources": sources_from_chunks(state.get("documents") or [])}


def should_answer_query(state: State):
    """Decide whether the query is a question worth answering (vs. a keyword search)."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Evaluate the query to determine if it requires an answer.\n"
                   "Respond with **True** if the query is a question needing an answer, otherwise "
                   "respond with **False** if it is a statement or does not require an answer."),
        ("human", "Is the query a question? Query: {query}"),
    ])
    chain = prompt | get_chat_model(settings.FAST_MODEL, num_ctx=FAST_NUM_CTX).with_structured_output(ShouldAnswerSchema)
    response = chain.invoke({"query": state["query"]})

    logger.info(f"==SHOULD_ANSWER== query: {state['query']} should_answer: {response.should_answer}")
    return {"should_answer": response.should_answer}


def summarize(state: State):
    formatted_sources = ""
    for source in state.get("sources"):
        formatted_sources += f"**{source['title']}**\n"
        formatted_sources += f"*Summary:* {source['summary']}\n"
        formatted_sources += f"*Year:* {source['year']}\n"
        formatted_sources += f"*Tags:* {', '.join([tag['name'] for tag in source['tags']])}\n"

        for content in source['contents']:
            formatted_sources += f"**{content['snippet']}**\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", SUMMARIZER_PROMPT),
        ("human", "Here are the sources:\n{sources}\n\nQuery: {query}")
    ])
    ai_msg = (prompt | get_chat_model()).invoke({"sources": formatted_sources, "query": state.get("query")})
    return {"summary": ai_msg.content}


def should_summarize(state: State):
    if state.get("sources") and state.get("should_answer"):
        return "generate_summary"
    return END


def create_rag_agent():
    builder = StateGraph(State)

    builder.add_node("retrieve_documents", retrieve)
    builder.add_node("format_sources", transform_documents)
    builder.add_node("check_should_summarize", should_answer_query)
    builder.add_node("generate_summary", summarize)

    # Retrieval and the question check run in parallel...
    builder.add_edge(START, "retrieve_documents")
    builder.add_edge(START, "check_should_summarize")
    builder.add_edge("retrieve_documents", "format_sources")
    # ...and the decision waits for both
    builder.add_node("decide", lambda state: {})
    builder.add_edge(["format_sources", "check_should_summarize"], "decide")
    builder.add_conditional_edges("decide", should_summarize, ["generate_summary", END])
    builder.add_edge("generate_summary", END)

    return builder.compile()


rag_agent = create_rag_agent()
