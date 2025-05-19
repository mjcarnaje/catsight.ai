import json
from typing import Annotated, Optional, Any, Dict, List, Tuple
from typing_extensions import TypedDict
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from ..services.ollama import base_url
from langchain_ollama import ChatOllama
from ..services.vectorstore import vector_store
import logging
from ..models import Document
from langchain.docstore.document import Document as Doc
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMListwiseRerank
from ..constant.prompts import SUMMARIZER_PROMPT
logger = logging.getLogger(__name__)

MODEL = "llama3.1:8b"

class IsRelevant(BaseModel):
    is_relevant: bool

class State(TypedDict):
    is_accurate: bool
    should_answer: bool
    query: str
    documents: List[Doc]
    sources: List[Dict[str, Any]]
    summary: str
    years: List[str]
    tags: List[str]


def retrieve(state: State):
    """
    This tool will retrieve documents from the vector store and filter them based on relevance to the query.

    Args:
        query (str): The query to retrieve documents on.
    """
    query = state.get("query")
    years = state.get("years")
    tags = state.get("tags")

    search_kwargs = {
        "score_threshold": 0.3,
    }

    filters = {}
    if years:
        filters["year"] = {"$in": years}
    
    if tags:
        filters["tags"] = {"$in": tags}
    
    if filters:
        search_kwargs["filter"] = filters

    retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs=search_kwargs,
    )
    

    llm = ChatOllama(model=MODEL, base_url=base_url, temperature=0)
    compressor = LLMListwiseRerank.from_llm(llm, top_n=10)
    compression_retriever = ContextualCompressionRetriever(
        base_compressor=compressor, base_retriever=retriever
    )

    docs = compression_retriever.invoke(query)

    return {
        "documents": docs
    }

def transform_documents(state: State):
    """
    This tool will transform the documents into a list of sources.

    Args:
        documents (List[Doc]): The list of documents to transform.
    """

    documents = state.get("documents")

    sources_map: Dict[Any, Dict[str, Any]] = {}
    
    for doc in documents:
        doc_id = doc.metadata.get("doc_id")
        chunk_index = doc.metadata.get("index")
        snippet = doc.page_content

        if doc_id is None:
            logger.info(f"DOC ID IS NONE: {doc}")
            continue

        if doc_id not in sources_map:
            try:
                d = Document.objects.get(id=doc_id)
            except Document.DoesNotExist:
                logger.info(f"DOCUMENT DOES NOT EXIST: {doc_id}")
                continue

            sources_map[doc_id] = {
                "id":            d.id,
                "title":         d.title,
                "summary":       d.summary,
                "year":          d.year,
                "tags":          list(d.tags.values('name', 'description')),
                "file_name":     d.file_name,
                "blurhash":      d.blurhash,
                "preview_image": d.preview_image,
                "file_type":     d.file_type,
                "created_at":    d.created_at.isoformat(),
                "updated_at":    d.updated_at.isoformat(),
                "contents":      [],
            }

        sources_map[doc_id]["contents"].append({
            "snippet":     snippet,
            "chunk_index": chunk_index,
        })

    return {
        "sources": list(sources_map.values()),
    }

def summarize(state: State):
    sources = state.get("sources")

    formatted_sources = ""

    for source in sources:
        formatted_sources += f"**{source['title']}**\n"
        formatted_sources += f"*Summary:* {source['summary']}\n"
        formatted_sources += f"*Year:* {source['year']}\n"
        formatted_sources += f"*Tags:* {', '.join([tag['name'] for tag in source['tags']])}\n"

        for content in source['contents']:
            formatted_sources += f"**{content['snippet']}**\n"

    logger.info(f"==SUMMARIZE== formatted_sources: {formatted_sources}")
  
    prompt = ChatPromptTemplate.from_messages([
        ("system", SUMMARIZER_PROMPT),
        ("human", "Here are the sources:\n{sources}\n\nQuery: {query}")
    ])

    # Bind the prompt with the chat model and structured output
    runnable = prompt | ChatOllama(model=MODEL, base_url=base_url, temperature=0)

    # Invoke the model with the conversation text
    ai_msg = runnable.invoke({"sources": formatted_sources, "query": state.get("query")})

    return {
        "summary": ai_msg.content,
    }

class ShouldAnswerSchema(BaseModel):
    should_answer: bool

def should_answer_query(state: State):
    query = state.get("query")
    
    system_prompt = """
Evaluate the query to determine if it requires an answer.
Respond with **True** if the query is a question needing an answer, otherwise respond with **False** if it is a statement or does not require an answer.
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", f"Is the query a question? Query: {query}"),
    ])

    chain = prompt | ChatOllama(model=MODEL, base_url=base_url, temperature=0).with_structured_output(schema=ShouldAnswerSchema)
    response = chain.invoke({"query": query})

    logger.info(f"==SHOULD_ANSWER== query: {query} should_answer: {response.should_answer}")

    return {
        "should_answer": response.should_answer,
    }

def should_summarize(state: State):
    has_sources = len(state.get("sources")) > 0

    if has_sources and state.get("should_answer"):
        return "generate_summary"
    else:
        return END

def create_rag_agent():
    builder = StateGraph(State)

    builder.add_node("retrieve_documents", retrieve)
    builder.add_node("check_should_summarize", should_answer_query)
    builder.add_node("format_sources", transform_documents)
    builder.add_node("generate_summary", summarize)
    
    builder.add_edge(START, "retrieve_documents")
    builder.add_edge("retrieve_documents", "format_sources")

    builder.add_edge("format_sources", "check_should_summarize")
    builder.add_conditional_edges(
        "check_should_summarize",
        should_summarize,
        {
            "generate_summary": "generate_summary",
            END: END,
        }
    )

    builder.add_edge("generate_summary", END)
    
    return builder.compile()

rag_agent = create_rag_agent()