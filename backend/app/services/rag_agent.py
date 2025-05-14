import json
from typing import Annotated, Optional, Any, Dict, List, Tuple
from typing_extensions import TypedDict
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from ..services.ollama import base_url
from langchain_ollama import ChatOllama
from ..services.vectorstore import retriever
import logging
from ..models import Document
from langchain.docstore.document import Document as Doc

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

def classify_snippet(query: str, snippet: str) -> bool:
    prompt = ChatPromptTemplate.from_messages([
        ("system", """
You are a helpful assistant tasked with evaluating whether a document snippet contains information that helps answer a given query.

Your job is to assess whether the snippet provides any relevant, useful, or supportive content for answering the query — either directly or indirectly.

If the snippet contains information that could reasonably contribute to answering the query, respond with:
**True**

If the snippet is irrelevant, unrelated, or does not help answer the query in any way, respond with:
**False**

Respond with ONLY **True** or **False** — no explanations or additional text.
        """),
        ("human", "Is the snippet relevant to the query? Query: {query} Snippet: {snippet}"),
    ])

    chain = prompt | ChatOllama(model=MODEL, base_url=base_url, temperature=0).with_structured_output(schema=IsRelevant)
    response = chain.invoke({"query": query, "snippet": snippet})

    return response.is_relevant
    

def filter_relevant_documents(state: State):
    """
    Filters documents based on their relevance to the query.

    Args:
        query (str): The query to check relevance against.
        docs (List[Any]): The list of documents to filter.

    Returns:
        List[Any]: The filtered list of relevant documents.
    """
    query = state.get("query")
    docs = state.get("documents")

    filtered_documents = []
    for doc in docs:
        is_relevant = classify_snippet(query, doc.page_content)
        if is_relevant:
            filtered_documents.append(doc)
    return {
        "documents": filtered_documents,
    }


def retrieve(state: State):
    """
    This tool will retrieve documents from the vector store and filter them based on relevance to the query.

    Args:
        query (str): The query to retrieve documents on.
    """
    query = state.get("query")
    docs = retriever.invoke(query)

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
                "tags":          d.tags,
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
    system_prompt = """
<system_description>
You are a CATSight.AI, an AI assistant for Mindanao State University – Iligan Institute of Technology (MSU-IIT), providing accurate, document-based information to summarize documents to answer a specific query.
</system_description>

<role_and_capabilities>
- Specialize in MSU-IIT's administrative documents like Special Orders, Memorandums, University Policies, Academic Calendars, and notices.
- Extract and synthesize relevant information from documents to answer queries.
- Support institutional transparency by helping interpret official MSU-IIT content.
- Do not respond to non-MSU-IIT related fictional or entertainment-based requests.
</role_and_capabilities>

<formatting_guidelines>
Use Markdown formatting to improve clarity:
- **Bold** for headers and key terms
- *Italics* for document titles and light emphasis
- > Blockquotes for direct excerpts from documents
- Bullet points or numbered lists for structured information
- ### Headings to organize longer responses
- [Hyperlinks](URL) to link to source documents when appropriate
<formatting_guidelines>

<context>
{sources}
</context>

<query>
{query}
</query>
"""

    sources = state.get("sources")

    formatted_sources = ""

    for source in sources:
        formatted_sources += f"**{source['title']}**\n"
        formatted_sources += f"*Summary:* {source['summary']}\n"
        formatted_sources += f"*Year:* {source['year']}\n"
        formatted_sources += f"*Tags:* {', '.join(source['tags'])}\n"

        for content in source['contents']:
            formatted_sources += f"**{content['snippet']}**\n"
  
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
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
    is_accurate = state.get("is_accurate")
    
    if not is_accurate:
        return {
            "should_answer": False,
        }

    system_prompt = """
<system_description>
You are CATSight.AI, an AI assistant for Mindanao State University – Iligan Institute of Technology (MSU-IIT), providing accurate, document-based information to support students, faculty, and staff in understanding institutional processes, policies, and communications.
</system_description>

<role_and_capabilities>
- Specialize in MSU-IIT's administrative documents like Special Orders, Memorandums, University Policies, Academic Calendars, and notices.
- Extract and synthesize relevant information from documents to answer queries.
- Support institutional transparency by helping interpret official MSU-IIT content.
- Do not respond to non-MSU-IIT related fictional or entertainment-based requests.
</role_and_capabilities>

<guidelines>
    - Reply with **True** if the query is a well-structured, relevant question requiring an answer, starting with words like "What", "How", "Why", "When", "Where", "Who", "Do this", "Do that", "Suggest me", "Recommend me", "Summarize", "Explain", "Tell me", "Help me", "I need to know", etc., but ensure it pertains to MSU-IIT, not general knowledge.
    - Reply with **False** if the query is not a question, is a name, a statement, ambiguous, irrelevant, or unsuitable for a response.
</guidelines>
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "Is the query a question? Query: {query}"),
    ])

    chain = prompt | ChatOllama(model=MODEL, base_url=base_url, temperature=0).with_structured_output(schema=ShouldAnswerSchema)
    response = chain.invoke({"query": query})

    logger.info(f"==SHOULD_ANSWER== query: {query} should_answer: {response.should_answer}")

    return {
        "should_answer": response.should_answer,
    }

def should_summarize(state: State):
    if state.get("should_answer"):
        return "generate_summary"
    else:
        return END

def should_filter_documents(state: State):
    if state.get("is_accurate"):
        return "filter_relevant_documents"
    else:
        return "format_sources"

def create_rag_agent():
    builder = StateGraph(State)

    builder.add_node("retrieve_documents", retrieve)
    builder.add_node("check_should_summarize", should_answer_query)
    builder.add_node("filter_relevant_documents", filter_relevant_documents)
    builder.add_node("format_sources", transform_documents)
    builder.add_node("generate_summary", summarize)
    
    builder.add_edge(START, "retrieve_documents")
    builder.add_conditional_edges(
        "retrieve_documents",
        should_filter_documents,
        {
            "filter_relevant_documents": "filter_relevant_documents",
            "format_sources": "format_sources",
        }
    )

    builder.add_edge("filter_relevant_documents", "format_sources")
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