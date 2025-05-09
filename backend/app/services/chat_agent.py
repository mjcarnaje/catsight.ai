import logging
import json
from typing import List, Optional, Dict, Annotated, Any
from typing_extensions import TypedDict

from django.conf import settings

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from ..models import Document

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

from ..services.vectorstore import vector_store, DB_URI
from ..services.ollama import LLAMA_CHAT

logger = logging.getLogger(__name__)

# --- Connection Pool Setup ------------------------------------------------
# Connection parameters for PostgreSQL
CONNECTION_KWARGS = {
    "application_name": "langgraph_app",
    "autocommit": True,
}

# Format DB_URI for psycopg (removing the +psycopg part if present)
def get_psycopg_connection_string(uri):
    """Convert SQLAlchemy URI to psycopg compatible format"""
    if uri.startswith("postgresql+psycopg://"):
        return uri.replace("postgresql+psycopg://", "postgresql://")
    return uri

PSYCOPG_DB_URI = get_psycopg_connection_string(DB_URI)

# Global connection pool
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

# --- Model Registry --------------------------------------------------------
# Supported models
MODELS = {
    "llama3.2:1b": LLAMA_CHAT,
}

# --- Prompt Constants -------------------------------------------------------
SYSTEM_PROMPT = """
You are CATSight.AI, an AI assistant for Mindanao State University – Iligan Institute of Technology (MSU-IIT).
You answer queries about MSU-IIT based primarily on retrieved documents and information sources.

<about_your_function>
Your primary role is to retrieve and present information from MSU-IIT's document repository. You should prioritize responding based on the specific documents and context retrieved rather than general knowledge.
</about_your_function>

<formatting>
Always format your responses using Markdown to improve readability:
- Use **bold** for emphasis on important terms or headers
- Use *italics* for document titles or subtle emphasis
- Use `code blocks` for specific technical information or course codes
- Use > blockquotes for direct quotations from documents
- Use bullet points or numbered lists for organized information
- Use ### headings to structure your response into clear sections
- Use --- horizontal rules to separate different document sources
- Use [hyperlinks](URL) if relevant URLs are provided in documents
</formatting>


<instructions>
1. ALWAYS prioritize information from retrieved documents over general knowledge.
2. CRITICAL: Carefully evaluate each retrieved document for relevance to the user's specific query:
   - If a document appears unrelated to the query, DO NOT include it in your response
   - For documents with low relevance scores (below 0.5), be extra critical when evaluating their usefulness
   - Focus only on the most relevant information that directly addresses the user query
3. When relevant documents are retrieved, indicate this with: "**Based on the documents I've found:**" and then provide the information.
4. If documents are retrieved but don't fully answer the query, state: "**The documents I have access to provide this information:**\n\n[summary of document content]\n\n
But I don't have complete information about [missing information]. You may want to check [suggest appropriate source or approach]."
5. If no relevant documents are found or if the retrieved documents are completely unrelated to the query, clearly state: "**I don't have specific document information about this topic.**" Then provide a general response based on common knowledge, clearly marking it as not document-based.
6. Always maintain academic integrity and factual accuracy - only state what is supported by the documents or is widely accepted knowledge.
</instructions>
"""

# --- State Definition -------------------------------------------------------
class AgentState(TypedDict):
    """State for the chat agent graph."""
    messages: Annotated[list, add_messages]
    title: Optional[str]
    should_generate_title: bool = True  

class ConfigSchema(TypedDict):
    """Configuration for the agent graph."""
    model: Optional[str] = "llama3.2:1b"
    thread_id: str


# --- Tool Definitions ------------------------------------------------------
@tool
def retrieve_context(query: str) -> list[object]:
    """
    Search for relevant documents about MSU-IIT based on the query.
    
    Only returns sources whose similarity score is >= score_threshold.
    Returns a JSON string of source-dicts or a message if none found.
    """
    score_threshold = 0.4
    top_k = 10
    
    if not query:
        return "No query provided."

    # 1) fetch (doc, score) pairs
    docs_with_scores = vector_store.similarity_search_with_score(query, k=top_k)

    # 2) filter out low-score chunks
    filtered = [(doc, score) for doc, score in docs_with_scores if score >= score_threshold]
    if not filtered:
        return json.dumps({"error": "No relevant documents found above score threshold."})

    # 3) group by document
    sources_map: Dict[Any, Dict[str, Any]] = {}
    
    for doc, score in filtered:
        doc_id = doc.metadata.get("doc_id")
        chunk_index = doc.metadata.get("index")
        snippet = doc.page_content

        if doc_id is None:
            continue

        if doc_id not in sources_map:
            try:
                d = Document.objects.get(id=doc_id)
            except Document.DoesNotExist:
                continue

            sources_map[doc_id] = {
                "id":           d.id,
                "title":        d.title,
                "description":  d.description,
                "file_name":    d.file_name,
                "blurhash":     d.blurhash,
                "preview_image":  d.preview_image,
                "file_type":    d.file_type,
                "created_at":   d.created_at.isoformat(),
                "updated_at":   d.updated_at.isoformat(),
                "contents":     [],
            }

        sources_map[doc_id]["contents"].append({
            "snippet":     snippet,
            "score":       score,
            "chunk_index": chunk_index,
        })

    # 4) dump to JSON and return
    return json.dumps(list(sources_map.values()))

@tool
def grade_relevance(query: str, context: list[object]) -> str:
    """Determine if the provided context is relevant to the query."""

    formatted_context = ""

    for c in context:
        formatted_context += f"Title: {c['title']}\nDescription: {c['description']}\nFile Name: {c['file_name']}\nFile Type: {c['file_type']}\nCreated At: {c['created_at']}\nUpdated At: {c['updated_at']}\nContent: {c['content']}\n\n"
    
    prompt = PromptTemplate(
        input_variables=["query", "context"],
        template="""
        Please carefully determine if the query is relevant to the context provided.

    <context>
    {formatted_context}
    </context>

    <query>
    {query}
    </query>

    <relevance_criteria>
    - If the context contains ANY information that could help answer the query, mark as "relevant"
    - If the context mentions ANY keywords, concepts, names, or topics from the query, mark as "relevant"
    - If the context provides even PARTIAL information related to the query, mark as "relevant"
    - If the context provides background information that would be helpful when answering the query, mark as "relevant"
    - Only mark as "not_relevant" if the context is COMPLETELY unrelated to the query
    </relevance_criteria>

        Based on these criteria, is the context relevant to the query?
        Answer with ONLY "relevant" or "not_relevant".
        """
    ).format(query=query, formatted_context=formatted_context)
    model = MODELS.get("llama3.2:1b")
    response = model.invoke([HumanMessage(content=prompt)])
    return response.content

# --- Helper Functions ------------------------------------------------------
def should_continue_tools(state: AgentState) -> str:
    """Determine if the assistant should use tools or finish."""
    messages = state["messages"]
    should_generate_title = state["should_generate_title"]
    
    if not messages:
        return END
    
    last_message = messages[-1]
    
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"

    if should_generate_title:
        return "generate_title"
    
    return END

def generate_title(state: AgentState) -> str:   
    """Generate a title for the query."""
    system_prompt = """
    You are tasked with generating a concise, descriptive title for a conversation between a user and an AI assistant. The title should capture the main topic or purpose of the conversation.
    Guidelines for title generation:
    - Keep titles extremely short (ideally 2-5 words)
    - Focus on the main topic or goal of the conversation
    - Use natural, readable language
    - Avoid unnecessary articles (a, an, the) when possible
    - Do not include quotes or special characters
    - Capitalize important words
    - Just return the title, no other text

    Here is the conversation:
    """ + "\n".join([m.content for m in state["messages"]]) 
    ai_msg = LLAMA_CHAT.invoke([SystemMessage(content=system_prompt)])
    
    title = ai_msg.content.split("\n\n")[1]    

    return {
        "title": title,
        "should_generate_title": False
    }

pool = get_connection_pool()
checkpointer = PostgresSaver(pool)

# --- Agent Implementation -------------------------------------------
def create_chat_agent():
    """
    Create a LangGraph agent for the MSU-IIT chatbot with persistence.
    
    Returns:
        Compiled LangGraph agent with persistence
    """
    # Initialize the checkpointer from connection pool
    checkpointer.setup()
    logger.info("PostgreSQL checkpointer setup completed")

    # Create tools list
    tools = [retrieve_context, grade_relevance]
    
    # Initialize the graph
    graph_builder = StateGraph(AgentState, ConfigSchema)
    
    # Define the chatbot node
    def chatbot(state: AgentState, config: RunnableConfig):
        """Process user input and generate appropriate responses."""
        # Get the model
        model_name = config["configurable"].get("model", "llama3.2:1b")
        model = MODELS.get(model_name, LLAMA_CHAT)
        model_with_tools = model.bind_tools(tools)
        
        # Get the messages from the state
        messages = state.get("messages", [])
        
        # If no messages, return empty state (shouldn't happen)
        if not messages:
            logger.warning("No messages in state, unexpected")
            return state
            
        # Get the current query from the last human message
        current_query = next((msg.content for msg in reversed(messages) if isinstance(msg, HumanMessage)), None)
        
        # Create the system message
        system_msg = SystemMessage(content=SYSTEM_PROMPT)
        
        # Invoke the model with all messages including system prompt
        response = model_with_tools.invoke([system_msg] + messages)
        
        # Return updated state
        return {
            "current_query": current_query,
            "messages": [response],
            "should_generate_title": state.get("should_generate_title", True)
        }
    
    # Define the tools node
    tools_node = ToolNode(tools=tools)
    
    # Add nodes to the graph
    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", tools_node)
    graph_builder.add_node("generate_title", generate_title)
    
    # Add edges to the graph
    graph_builder.add_edge(START, "chatbot")
    graph_builder.add_edge("tools", "chatbot")

    # Add conditional edges
    graph_builder.add_conditional_edges(
        "chatbot",
        should_continue_tools,
        {
            "tools": "tools",
            "generate_title": "generate_title",
            END: END
        }
    )
    
    # Compile with checkpointer and return the graph
    graph = graph_builder.compile(checkpointer=checkpointer)
    
    return graph

catsight_agent = create_chat_agent()