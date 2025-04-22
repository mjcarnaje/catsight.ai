import logging
from typing import List, TypedDict, Optional, Sequence, Literal, Any, Annotated, Dict, Any

from django.shortcuts import get_object_or_404

from langchain.schema import Document as LangchainDocument
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import PromptTemplate

from langchain_core.documents import Document
from ..services.vectorstore import vector_store
from ..services.ollama import OLLAMA_CHAT as LLM
from langgraph.graph.message import add_messages
from langgraph.graph import END, StateGraph, START
from langchain import hub

logger = logging.getLogger(__name__)
prompt = hub.pull("rlm/rag-prompt")

# --- State type --------------------------------------------------------------
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    context: List[Document]
    current_query: Optional[str] = None
    error: Optional[str] = None

# --- System prompt ----------------------------------------------------------
SYSTEM_PROMPT = SystemMessage(content="""
<system>
You are CATSight.AI, the official AI assistant for MSU-IIT.
Answer based ONLY on the provided context. If you don't know, say so.
Cite sources.
</system>
""")

# --- Node: retrieve ----------------------------------------------------------
def retrieve(state: AgentState) -> Dict[str, Any]:
    # Get last human query
    human_msgs = [m for m in state["messages"] if isinstance(m, HumanMessage)]
    
    if not human_msgs:
        return {"context": [], "current_query": None, "error": "No user query"}

    query = human_msgs[-1].content
    
    docs = vector_store.similarity_search(query)
    return {"context": docs, "current_query": query, "error": None}
# --- Node: generate ---------------------------------------------------------

def generate(state: AgentState):
    docs_content = "\n\n".join(doc.page_content for doc in state["context"])
    messages = prompt.invoke({"question": state["current_query"], "context": docs_content})
    response = LLM.invoke(messages)
    return {"messages": [*state["messages"], response]}    
    

# --- Build workflow ---------------------------------------------------------
def create_workflow():
    # Create the graph
    graph = StateGraph(AgentState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate", generate)
    
    # Define the workflow: START -> retrieve -> generate -> END
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    
    return graph.compile()

# Instantiate
graph = create_workflow()
