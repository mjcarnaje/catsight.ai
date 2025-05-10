import datetime
from typing import Annotated, List, Optional, Dict, Any
from typing_extensions import TypedDict
from pydantic import BaseModel
from django.conf import settings

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages
from langgraph.prebuilt import tools_condition, ToolNode
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from langgraph.errors import NodeInterrupt
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import Runnable, RunnableConfig, RunnableLambda
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool, Tool
from ..services.ollama import base_url, MODELS
from langchain_ollama import ChatOllama
from ..services.vectorstore import retriever_tool, DB_URI
from ..models import Document
import logging
import json

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
- When faced with queries that have random context, aim to deliver the most accurate response possible using only the relevant context provided. If the context does not sufficiently address the query, reply with "I'm sorry, I don't know the answer to that question."

- For queries about fictional characters (e.g., Superman, Harry Potter), entertainment celebrities, requests for creative content generation (poems, jokes), personal opinions on controversial topics, or harmful information, politely respond:
  "I'm specialized in answering questions about MSU-IIT administrative documents like Special Orders, Memorandums, University circulars, Academic calendars, Board resolutions, University announcements, Student policies, Faculty directives, and other administrative documents. I'd be happy to assist with questions related to these topics instead."

- BE VERY LENIENT with all other queries. Process most questions through your document retrieval system, including general educational questions, questions about locations, organizations, persons, academic subjects, and any university-related topics.
</instructions>
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
        Please carefully determine if the query is relevant to the context provided.

    <context>
    {context}
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
        You are an expert extraction algorithm. Only extract relevant information from the text. If you do not know the value of an attribute asked to extract, return null for the attribute's value.

        Create a concise and descriptive 3-6 word title for a conversation between a user and MSU-IIT's AI assistant.

        <title_requirements>
        - 3-6 words, extremely brief
        - Describes the main topic or question
        - Relevant to MSU-IIT university context if applicable
        - Avoid articles (a, an, the) unless necessary
        - No special characters or quotes
        - Title Case format (Capitalize Important Words)
        - Provide only the title, no additional text
        - Do not include any other text or comments
        - Avoid using the word "Summary of", etc.
        </title_requirements>
        """

    # Combine conversation messages into a single string
    conversation_text = "\n".join([m.content for m in state["messages"] if isinstance(m, HumanMessage)])

    # Create the prompt template
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{text}")
    ])

    # Bind the prompt with the chat model and structured output
    runnable = prompt | ChatOllama(model="llama3.2:1b", base_url=base_url, temperature=1).with_structured_output(schema=Title)

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