from datetime import datetime
import json
from typing import Annotated, Optional, Any
from typing_extensions import TypedDict
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages
from langgraph.prebuilt import tools_condition, ToolNode
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from langgraph.prebuilt import InjectedState, ToolNode
from langchain_core.runnables import RunnableConfig, RunnableLambda
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from ..services.ollama import base_url
from langchain_ollama import ChatOllama
from ..services.vectorstore import vector_store, DB_URI
from langchain_core.runnables import RunnableConfig
import logging
from typing import Any, Dict
from ..models import Document
from ..services.postgres import get_psycopg_connection_string
from langchain_classic.retrievers.contextual_compression import ContextualCompressionRetriever
from langchain_classic.retrievers.document_compressors import LLMListwiseRerank
from ..constant.prompts import CATSIGHT_PROMPT, TITLE_GENERATION_PROMPT

logger = logging.getLogger(__name__)

CONNECTION_KWARGS = {
    "application_name": "langgraph_app",
    "autocommit": True,
}

PSYCOPG_DB_URI = get_psycopg_connection_string(DB_URI)

_connection_pool = None

def get_connection_pool():
    """Get or initialize the connection pool"""
    global _connection_pool

    if _connection_pool is None:
        _connection_pool = ConnectionPool(
            conninfo=PSYCOPG_DB_URI,
            max_size=20,
            kwargs=CONNECTION_KWARGS,
        )
        logger.info(f"Created PostgreSQL connection pool for LangGraph using: {PSYCOPG_DB_URI}")
    return _connection_pool

# --- Tool Error Handler -------------------------------------------------------
def handle_tool_error(state) -> dict:
    error = state.get("error")
    tool_calls = state["messages"][-1].tool_calls
    return {
        "messages": [
            ToolMessage(
                content=f"Error: {repr(error)}\nPlease fix your mistakes.",
                tool_call_id=tc["id"],
            )
            for tc in tool_calls
        ]
    }

def create_tool_node_with_fallback(tools: list) -> dict:
    return ToolNode(tools).with_fallbacks(
        [RunnableLambda(handle_tool_error)], exception_key="error"
    )

# --- State Definition -------------------------------------------------------
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    title: Optional[str]
    should_generate_title: bool = True  
    file_ids: Optional[list[int]] = None

# --- Helper Classes -------------------------------------------------------
class Title(BaseModel):
    title: str

class IsRelevant(BaseModel):
    is_relevant: bool

# --- Assistant Class -------------------------------------------------------
class Assistant:
    def __init__(self, prompt: ChatPromptTemplate, tools: list):
        self.prompt = prompt
        self.tools = tools


    def __call__(self, state: State, config: RunnableConfig):
        configuration = config.get("configurable", {})
        model_key = configuration.get("model")
        self.runnable = self.prompt | ChatOllama(model=model_key, base_url=base_url, temperature=1).bind_tools(self.tools)

        while True:
            result = self.runnable.invoke(state)
            # If the LLM happens to return an empty response, we will re-prompt it
            # for an actual response.
            if not result.tool_calls and (
                not result.content
                or isinstance(result.content, list)
                and not result.content[0].get("text")
            ):
                messages = state["messages"] + [("user", "Respond with a real output.")]
                state = {**state, "messages": messages}
            else:
                break
        return {"messages": result}

# --- Prompt Constants -------------------------------------------------------
# Create the ChatPromptTemplate for the assistant
primary_assistant_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        CATSIGHT_PROMPT
    ),
    ("placeholder", "{messages}"),
]).partial(today_date=datetime.now().strftime("%Y-%m-%d"))

@tool(parse_docstring=True)
def retrieve(query: str, config: RunnableConfig, state: Annotated[dict, InjectedState]) -> str:
    """
    This tool will retrieve documents from the vector store and filter them based on relevance to the query.

    Args:
        query (str): The query to retrieve documents on.
    """
    file_ids = state.get("file_ids", [])
    has_file_ids = len(file_ids) > 0

    search_kwargs = {
        "score_threshold": 0.3,
    }

    if has_file_ids:
        search_kwargs["filter"] = {"doc_id": {"$in": file_ids}}

    retriever = vector_store.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs=search_kwargs,
    )
    
    model_id = config["configurable"].get("model")
    llm = ChatOllama(model=model_id, base_url=base_url, temperature=0)
    compressor = LLMListwiseRerank.from_llm(llm, top_n=10)
    compression_retriever = ContextualCompressionRetriever(
        base_compressor=compressor, base_retriever=retriever
    )

    docs = compression_retriever.invoke(query)
           
    sources_map: Dict[Any, Dict[str, Any]] = {}
    
    for doc in docs:
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

    return json.dumps(list(sources_map.values()))

# --- Helper Functions ------------------------------------------------------
def generate_title(state: State) -> dict:
    """
    Generate a concise and descriptive 3-6 word title for a conversation between a user and MSU-IIT's AI assistant.
    """

    # System prompt with title requirements - now using the constant from prompts.py
    system_prompt = TITLE_GENERATION_PROMPT

    # Combine conversation messages into a single string
    conversation_text = "\n".join([m.content for m in state["messages"] if isinstance(m, HumanMessage)])

    # Create the prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{text}")
    ])

    # Bind the prompt with the chat model and structured output
    runnable = prompt | ChatOllama(model="llama3.2:1b", base_url=base_url, temperature=0).with_structured_output(schema=Title)

    # Invoke the model with the conversation text
    ai_msg = runnable.invoke({"text": conversation_text})

    # Extract the title from the structured response
    title = ai_msg.title.strip()

    # Log the generated title
    logger.info(f"Generated title: {title}")

    return {
        "title": title,
        "should_generate_title": False
    }

def generate_title_condition(state: State):
    """Determine if the assistant should generate a title."""
    messages = state["messages"]
    should_generate_title = state.get("should_generate_title", True)
    
    if len(messages) > 3 and should_generate_title:
        return "generate_title"
    
    return END

# --- Agent Implementation -------------------------------------------
def create_catsight_agent():
    """
    Create a LangGraph agent for the MSU-IIT chatbot with persistence.
    
    Returns:
        Compiled LangGraph agent with persistence
    """
    # Initialize the pool and checkpointer
    pool = get_connection_pool()
    checkpointer = PostgresSaver(pool)
    checkpointer.setup()
    logger.info("PostgreSQL checkpointer setup completed")

    # Define the tools
    tools = [retrieve]

    # Build the graph
    builder = StateGraph(State)
    
    # Define nodes
    builder.add_node("assistant", Assistant(primary_assistant_prompt, tools))
    builder.add_node("tools", create_tool_node_with_fallback(tools))
    builder.add_node("generate_title", generate_title)
    
    # Define edges
    builder.add_edge(START, "assistant")
    
    builder.add_conditional_edges(
        "assistant",
        tools_condition,
    )
    builder.add_edge("tools", "assistant")
    
    # Add conditional edge for title generation
    builder.add_conditional_edges(
        "assistant",
        generate_title_condition,
        {
            "generate_title": "generate_title",
            END: END
        }
    )
    
    builder.add_edge("generate_title", END)
    
    # Compile with checkpointer and return the graph
    graph = builder.compile(checkpointer=checkpointer)
    
    return graph

# Create the agent instance
catsight_agent = create_catsight_agent()