"""Map-reduce document summarizer.

START ─► generate_summary (one per chunk, in parallel via Send)
      ─► collect_summaries ─► [collapse_summaries]* ─► generate_final_summary
      ─► extract_metadata (title + year + tags in a single structured call) ─► END

Callers should pass config={"max_concurrency": N} so a long document doesn't
fire hundreds of simultaneous requests at Ollama.
"""
import logging
import operator
from typing import Annotated, Any, Callable, List, Literal, Optional, TypedDict

from asgiref.sync import sync_to_async
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field, field_validator

from ..constant.prompts import (
    SUMMARIZATION_MAP_PROMPT,
    SUMMARIZATION_METADATA_PROMPT,
    SUMMARIZATION_REDUCE_PROMPT,
)
from ..models import Tag
from .ollama import get_chat_model

logger = logging.getLogger(__name__)

TOKEN_MAX = 5000  # collapse summaries above this; must stay below OLLAMA_NUM_CTX
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
SEPARATOR = ["\n\n", "\n", ".", " ", ""]

summarization_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=SEPARATOR,
)

map_prompt = ChatPromptTemplate.from_messages([
    ("system", SUMMARIZATION_MAP_PROMPT),
    ("human", "Document:\n\n{content}\n\nPlease follow the instructions above to summarize."),
])

reduce_prompt = ChatPromptTemplate.from_messages([
    ("system", SUMMARIZATION_REDUCE_PROMPT),
    ("human", "Summaries:\n\n{docs}\n\nPlease synthesize the above summaries into a cohesive overview."),
])


class DocumentMetadata(BaseModel):
    # Every field is required (year may be null): with Ollama's JSON-schema output,
    # small instruct models skip optional fields, which silently left tags empty.
    title: str = Field(description="Concise, descriptive title in Title Case, excluding institutional identifiers.")
    year: Optional[int] = Field(description="Four-digit issuance year, or null if the summary states none.")
    tags: list[str] = Field(description="1-3 tag names copied exactly from the allowed list.")

    @field_validator("year")
    @classmethod
    def plausible_year(cls, year: Optional[int]) -> Optional[int]:
        # Small models sometimes return 0 or a page number instead of null
        return year if year is not None and 1900 <= year <= 2100 else None


class OverallState(TypedDict):
    contents: List[str]
    summaries: Annotated[list, operator.add]
    collapsed_summaries: List[Document]
    final_summary: str
    title: str
    year: Optional[int]
    tags: List[int]
    model_name: str


class SummaryState(TypedDict):
    content: str
    model_name: str


# --- Helpers ----------------------------------------------------------------
def split_list_of_docs(
    docs: List[Document], length_func: Callable, token_max: int, **kwargs: Any
) -> List[List[Document]]:
    """Split documents into batches that fit within token_max."""
    new_result_doc_list = []
    _sub_result_docs = []
    for doc in docs:
        _sub_result_docs.append(doc)
        _num_tokens = length_func(_sub_result_docs, **kwargs)
        if _num_tokens > token_max:
            if len(_sub_result_docs) == 1:
                raise ValueError(
                    "A single document was longer than the context length,"
                    " we cannot handle this."
                )
            new_result_doc_list.append(_sub_result_docs[:-1])
            _sub_result_docs = _sub_result_docs[-1:]
    new_result_doc_list.append(_sub_result_docs)
    return new_result_doc_list


async def acollapse_docs(
    docs: List[Document],
    combine_document_func: Callable,
    **kwargs: Any,
) -> Document:
    """Collapse documents with a combine function, merging their metadata."""
    result = await combine_document_func(docs, **kwargs)
    combined_metadata = {k: str(v) for k, v in docs[0].metadata.items()}
    for doc in docs[1:]:
        for k, v in doc.metadata.items():
            if k in combined_metadata:
                combined_metadata[k] += f", {v}"
            else:
                combined_metadata[k] = str(v)
    return Document(page_content=result, metadata=combined_metadata)


def length_function(documents: List[Document], model_name: str) -> int:
    llm = get_chat_model(model_name)
    return sum(llm.get_num_tokens(doc.page_content) for doc in documents)


async def _reduce(docs: List[Document], model_name: str) -> str:
    prompt = reduce_prompt.invoke({"docs": docs})
    response = await get_chat_model(model_name).ainvoke(prompt)
    return response.content


# --- Nodes ------------------------------------------------------------------
async def generate_summary(state: SummaryState):
    """Summarize a single chunk."""
    prompt = map_prompt.invoke({"content": state["content"]})
    response = await get_chat_model(state.get("model_name")).ainvoke(prompt)
    return {"summaries": [response.content]}


def map_summaries(state: OverallState):
    """Fan out one generate_summary per chunk."""
    model_name = state.get("model_name")
    return [
        Send("generate_summary", {"content": content, "model_name": model_name})
        for content in state["contents"]
    ]


def collect_summaries(state: OverallState):
    return {"collapsed_summaries": [Document(summary) for summary in state["summaries"]]}


async def collapse_summaries(state: OverallState):
    """Merge summaries in batches while together they exceed TOKEN_MAX."""
    model_name = state.get("model_name")
    doc_lists = split_list_of_docs(
        state["collapsed_summaries"], lambda docs: length_function(docs, model_name), TOKEN_MAX
    )
    results = []
    for doc_list in doc_lists:
        results.append(await acollapse_docs(doc_list, lambda x: _reduce(x, model_name)))
    return {"collapsed_summaries": results}


def should_collapse(state: OverallState) -> Literal["collapse_summaries", "generate_final_summary"]:
    num_tokens = length_function(state["collapsed_summaries"], state.get("model_name"))
    return "collapse_summaries" if num_tokens > TOKEN_MAX else "generate_final_summary"


async def generate_final_summary(state: OverallState):
    return {"final_summary": await _reduce(state["collapsed_summaries"], state.get("model_name"))}


@sync_to_async
def _available_tags() -> dict[str, tuple[int, str, str]]:
    """Lower-cased tag name -> (id, name, description)."""
    return {name.lower(): (tag_id, name, description)
            for tag_id, name, description in Tag.objects.values_list("id", "name", "description")}


async def extract_metadata(state: OverallState):
    """Title, year and tags in one structured call (was three serial LLM calls)."""
    tags = await _available_tags()
    formatted_tags = "\n- ".join(f"{name}: {description}" for _, name, description in tags.values())

    prompt = ChatPromptTemplate.from_messages([
        ("system", SUMMARIZATION_METADATA_PROMPT.format(formatted_tags=formatted_tags)),
        ("human", "Summary:\n\n{summary}"),
    ])
    chain = prompt | get_chat_model(state.get("model_name")).with_structured_output(DocumentMetadata)
    metadata: DocumentMetadata = await chain.ainvoke({"summary": state["final_summary"]})

    # Keep only tags that exist (case-insensitive); small models paraphrase names
    tag_ids = list(dict.fromkeys(tags[t.lower()][0] for t in metadata.tags if t.lower() in tags))
    logger.info(f"Extracted metadata: title={metadata.title!r} year={metadata.year} tags={metadata.tags} -> ids {tag_ids}")
    return {"title": metadata.title.strip(), "year": metadata.year, "tags": tag_ids}


# --- Graph ------------------------------------------------------------------
graph = StateGraph(OverallState)
graph.add_node("generate_summary", generate_summary)
graph.add_node("collect_summaries", collect_summaries)
graph.add_node("collapse_summaries", collapse_summaries)
graph.add_node("generate_final_summary", generate_final_summary)
graph.add_node("extract_metadata", extract_metadata)

graph.add_conditional_edges(START, map_summaries, ["generate_summary"])
graph.add_edge("generate_summary", "collect_summaries")
graph.add_conditional_edges("collect_summaries", should_collapse)
graph.add_conditional_edges("collapse_summaries", should_collapse)
graph.add_edge("generate_final_summary", "extract_metadata")
graph.add_edge("extract_metadata", END)

summarization_agent = graph.compile()
