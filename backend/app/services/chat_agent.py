import logging
import json
import re
from typing import List, Dict, Any, TypedDict

from django.shortcuts import get_object_or_404

from langchain.schema import Document as LangchainDocument

from ..models import Document
from ..services.vectorstore import vector_store
from ..services.ollama import OLLAMA_CHAT as LLM
from langchain import hub
from enum import Enum
logger = logging.getLogger(__name__)

RAG_PROMPT = hub.pull("rlm/rag-prompt")

class ChatStates(Enum):
    RETRIEVE  = "retrieve"
    GENERATE  = "generate"
    GRADE     = "score"
    FORMAT    = "format"


class ChatState(TypedDict):
    question: str
    context: List[LangchainDocument]
    sources: List[Dict[str, Any]]
    answer: str
    grade: Dict[str, Any]

def assistant_chat(state: ChatState) -> Dict[str, Any]:
    logger.info(f"Assistant chat: {state['question']}")
    return {"answer": "I'm sorry, I don't know how to answer that."}

def retrieve(state: ChatState) -> Dict[str, Any]:
    logger.info(f"Retrieving documents for query: {state['question']}")
    retrieved = vector_store.similarity_search(state["question"], k=5)
    sources: List[Dict[str, Any]] = []

    for doc in retrieved:
        doc_id = doc.metadata.get("doc_id")
        similarity = doc.metadata.get("score", 0.0)
        index = doc.metadata.get("index")

        try:
            db_doc = get_object_or_404(Document, id=doc_id)
            title = db_doc.title
        except Exception:
            logger.warning(f"Doc {doc_id} not found, skipping.")
            continue

        entry = next((s for s in sources if s["document_id"] == doc_id), None)
        chunk = {
            "chunk_index": index,
            "content": doc.page_content,
            "similarity": similarity,
        }

        if entry:
            entry["chunks"].append(chunk)
            entry["total_similarity"] += similarity
        else:
            sources.append({
                "document_id": doc_id,
                "document_title": title,
                "total_similarity": similarity,
                "chunks": [chunk],
            })

    # sort highest relevance first
    sources.sort(key=lambda s: s["total_similarity"], reverse=True)

    return {"context": retrieved, "sources": sources}


def generate(state: ChatState) -> Dict[str, Any]:
    logger.info("Generating answer based on context")
    docs_content = "\n\n".join(doc.page_content for doc in state["context"])
    messages = RAG_PROMPT.invoke({
        "question": state["question"],
        "context": docs_content
    })
    response = LLM.invoke(messages)
    return {"answer": response.content}


def grade_answer(state: ChatState) -> Dict[str, Any]:
    logger.info("Grading the generated answer")
    if not state["context"]:
        return {"grade": {
            "relevance": "Low",
            "accuracy": "Insufficient context",
            "score": 0
        }}

    grading_prompt = (
        "You are an expert evaluator. Assess the following answer for a user query.\n\n"
        f"User query: {state['question']}\n\n"
        f"Answer: {state['answer']}\n\n"
        "Provide JSON only with keys: relevance (High/Medium/Low), "
        "accuracy (1-10), score (1-10)."
    )

    messages = [
        {"role": "system", "content": "You are an expert evaluator that only responds with JSON."},
        {"role": "user", "content": grading_prompt},
    ]

    try:
        resp = LLM.invoke(messages)
        match = re.search(r'({.*})', resp.content, re.DOTALL)
        grade_json = json.loads(match.group(1)) if match else {}
    except Exception as e:
        logger.error("Grading failed", exc_info=True)
        grade_json = {
            "relevance": "Error",
            "accuracy": "Error",
            "score": 0
        }

    return {"grade": grade_json}


def format_output(state: ChatState) -> Dict[str, Any]:
    logger.info("Formatting final payload")
    return {
        "answer": state["answer"],
        "sources": state["sources"],
        "grade": state.get("grade"),
    }

