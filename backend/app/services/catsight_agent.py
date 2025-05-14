import json
from typing import Annotated, Optional, Any
from typing_extensions import TypedDict
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages
from langgraph.prebuilt import tools_condition, ToolNode
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig, RunnableLambda
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from ..services.ollama import base_url
from langchain_ollama import ChatOllama
from ..services.vectorstore import retriever, DB_URI
from langchain_core.runnables import RunnableConfig
import logging
from typing import Any, Dict
from ..models import Document

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

def _print_event(event: dict, _printed: set, max_length=1500):
    current_state = event.get("dialog_state")
    if current_state:
        print("Currently in: ", current_state[-1])
    message = event.get("messages")
    if message:
        if isinstance(message, list):
            message = message[-1]
        if message.id not in _printed:
            msg_repr = message.pretty_repr(html=True)
            if len(msg_repr) > max_length:
                msg_repr = msg_repr[:max_length] + " ... (truncated)"
            print(msg_repr)
            _printed.add(message.id)

# --- State Definition -------------------------------------------------------
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    title: Optional[str]
    should_generate_title: bool = True  

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
        model_key = configuration.get("model", "llama3.2:1b")
        self.runnable = self.prompt | ChatOllama(model=model_key, base_url=base_url, temperature=1).bind_tools(self.tools, tool_choice="any")

        while True:
            state = {**state}
            result = self.runnable.invoke(state)
            # If the LLM happens to return an empty response or starts with "Error: ", we will re-prompt it
            # for an actual response.
            if not result.tool_calls and (
                not result.content
                or (isinstance(result.content, list) and not result.content[0].get("text"))
                or (isinstance(result.content, str) and result.content.startswith("Error: "))
            ):
                messages = state["messages"] + [("user", "Respond with a real output.")]
                state = {**state, "messages": messages}
            else:
                break
        return {"messages": result}

# --- Prompt Constants -------------------------------------------------------
primary_assistant_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are CATSight.AI, an AI assistant built specifically for Mindanao State University – Iligan Institute of Technology (MSU-IIT).

Your purpose is to provide accurate, reliable, and document-based information about MSU-IIT. You support students, faculty, and staff by helping them understand institutional processes, policies, and official communications. Your responses must be grounded in retrieved content from MSU-IIT’s official document repository.

<role_and_capabilities>
- You specialize in MSU-IIT's administrative documents such as Special Orders, Memorandums, University Policies, Academic Calendars, and internal notices.
- You extract and synthesize relevant information from retrieved documents to answer user queries.
- You support institutional transparency by helping users interpret and understand official MSU-IIT content.
- You do not respond to fictional, creative, or entertainment-based requests unless directly related to MSU-IIT.

<retrieval_guidance>
- Retrieved documents may contain irrelevant or noisy content.
- Prioritize answering the user's question clearly and directly.
- Ignore unrelated or low-value text in the retrievals unless it supports the response.
- Do not summarize the entire context if only a portion is needed to address the query effectively.

<interaction_style>
- Be clear, respectful, and supportive. Use a professional tone with a friendly edge.
- Your goal is to make university processes and policies easier to understand.
- If there is not enough information in the retrieved documents, respond: “I don't have enough information to answer that question completely.”

<formatting_guidelines>
Use Markdown formatting to improve clarity:
- **Bold** for headers and key terms
- *Italics* for document titles and light emphasis
- > Blockquotes for direct excerpts from documents
- Bullet points or numbered lists for structured information
- ### Headings to organize longer responses
- [Hyperlinks](URL) to link to source documents when appropriate

<response_guidelines>
- Only use information from retrieved MSU-IIT documents or content.
- Do not use outside general knowledge unless it is explicitly supported by the retrieved context.
- If a query is unrelated to MSU-IIT's administrative scope (e.g., about celebrities, fiction, games), respond:
  “I specialize in MSU-IIT administrative information like Special Orders, Memorandums, University policies, Academic calendars, and other institutional documents. I’d be happy to help with questions related to the university instead.”
- For academic or educational queries related to MSU-IIT, be as helpful and explanatory as possible.
- Focus responses on the user's intent, not just document summarization.

You exist to assist with MSU-IIT's institutional clarity—prioritize helpfulness, precision, and relevance.
""",
        ),
        ("placeholder", "{messages}"),
    ]
)

def classify_snippet(model_id: str, query: str, snippet: str) -> bool:
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

    chain = prompt | ChatOllama(model=model_id, base_url=base_url, temperature=1).with_structured_output(schema=IsRelevant)
    response = chain.invoke({"query": query, "snippet": snippet})

    return response.is_relevant
    

# --- Tool Definitions ------------------------------------------------------
@tool(parse_docstring=True)
def retrieve(query: str, config: RunnableConfig) -> str:
    """
    This tool will retrieve documents from the vector store and filter them based on relevance to the query.

    Args:
        query (str): The query to retrieve documents on.
    """
    model_id = config["configurable"].get("model", "llama3.2:1b")
    docs = retriever.invoke(query)
    filtered_documents = []

    for doc in docs:
        is_relevant = classify_snippet(model_id, query, doc.page_content)
        logger.info(f"==RETRIEVE== Is the snippet relevant to the query? {is_relevant}")

        if is_relevant:
            filtered_documents.append(doc)
            
    sources_map: Dict[Any, Dict[str, Any]] = {}
    
    for doc in filtered_documents:
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

    return json.dumps(list(sources_map.values()))

# --- Helper Functions ------------------------------------------------------
def generate_title(state: State) -> dict:
    """
    Generate a concise and descriptive 3-6 word title for a conversation between a user and MSU-IIT's AI assistant.
    """

    # System prompt with title requirements
    system_prompt = """
You are a precise extraction system that creates concise, descriptive titles for conversations.

<title_requirements>
- Length: 3-6 words maximum
- Format: Title Case (capitalize main words)
- Style: Clear, specific, and descriptive of the main topic
- Context: Reflect MSU-IIT university context where applicable
- Avoid: Articles (a, an, the), special characters, quotation marks
- Do NOT include phrases like "Summary of" or "About"
</title_requirements>

Extract the main topic from the conversation and create a title that captures its essence.
Return ONLY the title text without any additional explanation or formatting.
    """

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