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
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.messages import HumanMessage, ToolMessage
from langchain_core.tools import tool
from ..services.ollama import base_url
from langchain_ollama import ChatOllama
from ..services.vectorstore import retriever_tool, DB_URI
import logging

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
    is_msu_iit_related: bool = False

# --- Helper Classes -------------------------------------------------------
class Title(BaseModel):
    title: str

class IntentCheck(BaseModel):
    is_msu_iit_related: bool

# --- Assistant Class -------------------------------------------------------
class Assistant:
    def __init__(self, prompt: ChatPromptTemplate, tools: list):
        self.prompt = prompt
        self.tools = tools


    def __call__(self, state: State, config: RunnableConfig):
        configuration = config.get("configurable", {})
        model_key = configuration.get("model", "llama3.2:1b")
        self.runnable = self.prompt | ChatOllama(model=model_key, base_url=base_url, temperature=1).bind_tools(self.tools)

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
            """You are CATSight.AI, an AI assistant for Mindanao State University – Iligan Institute of Technology (MSU-IIT).
You provide factual, accurate information about MSU-IIT based on retrieved documents from the institution's repository.

<role_and_capabilities>
- You are specifically designed to help with MSU-IIT administrative documents, policies, and information
- You prioritize responding based on retrieved documents rather than general knowledge
- You excel at finding relevant information from the university's document repository
</role_and_capabilities>

<formatting_guidelines>
Use Markdown formatting to enhance readability:
- **Bold** for important terms, headers, and emphasis
- *Italics* for document titles and subtle emphasis
- > Blockquotes for direct quotations from documents
- Bullet points or numbered lists for organizing information
- ### Headings to structure responses into clear sections
- [Hyperlinks](URL) for relevant URLs mentioned in documents
</formatting_guidelines>

<response_guidelines>
- Answer based ONLY on retrieved context. If insufficient context exists, respond with "I don't have enough information to answer that question completely."
- For completely unrelated queries (fictional characters, entertainment, creative content requests), politely respond:
  "I specialize in MSU-IIT administrative information like Special Orders, Memorandums, University policies, Academic calendars, and other institutional documents. I'd be happy to help with questions related to the university instead."
- Be lenient with academic, educational, and university-related questions, always attempting to provide helpful information from available documents.
- Present information in a concise, organized manner that's easy to understand.
</response_guidelines>
""",
        ),
        ("placeholder", "{messages}"),
    ]
)

# --- Tool Definitions ------------------------------------------------------
@tool
def grade_relevance(query: str, context: str) -> str:
    """Determine if the provided context is relevant to the query."""

    prompt = PromptTemplate(
        input_variables=["query", "context"],
        template="""
Determine if the context is relevant to the query by analyzing semantic and keyword relationships.

<context>
{context}
</context>

<query>
{query}
</query>

<relevance_criteria>
Context is RELEVANT if it:
- Contains ANY information that directly answers or relates to the query
- Contains significant keywords, names, terms, or concepts from the query
- Provides partial information, background, or related details useful for answering
- Discusses the same topic, event, policy, or subject matter as the query
- Would be helpful to include when formulating a complete response

Context is NOT RELEVANT only if it is COMPLETELY unrelated to the query's topic.
</relevance_criteria>

Based on these criteria, is the context relevant to the query?
Respond with ONLY "relevant" or "not_relevant".
        """
    ).format(query=query, context=context)
    model = ChatOllama(model="llama3.2:1b", base_url=base_url, temperature=1)
    response = model.invoke([HumanMessage(content=prompt)])
    return response.content

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
    tools = [retriever_tool, grade_relevance]

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