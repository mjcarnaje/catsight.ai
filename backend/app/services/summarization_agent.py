from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field
from enum import Enum
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ..models import Tag
from asgiref.sync import sync_to_async

def get_llm(model_name= "llama3.1:8b"):
    """Get a language model instance with the specified model name."""
    return ChatOllama(model=model_name, base_url="http://ollama:11434", temperature=0)

llm = get_llm()

map_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a professional summarizer specializing in educational administrative documents. Your task is to extract structured notes and provide a clear, concise summary in markdown format.

Follow these instructions carefully:

1. **Heading**: Identify the subject line as the main heading if present. If not, construct one using the document type (e.g., "Memorandum"), order number, and year.
2. **Important Notes Section**:
   - Extract key administrative metadata, such as:
     - Order Type (Resolution, Memorandum, Special Order, etc.)
     - Order Number
     - Series or Year
     - Relevant Dates (e.g., issuance, implementation)
     - Any involved departments, regions, or offices
     - Key stakeholders or recipients (e.g., schools, divisions)
3. **Summary Section**:
   - Focus on core actions or directives only.
   - Remove introductions, signatures, and unnecessary context.
   - Use **present-tense verbs** (e.g., "Announces", "Requires", "Suspends").
   - Maintain a **neutral, formal tone**.
4. **Format**:
Return your output in **markdown** only. Do not include any commentary or explanation.

Use this template:

# {{Constructed or Extracted Title}}

## Important Notes
- **Order Type**: [Type (Resolution, Memorandum, Special Order, etc.)]
- **Order Number**: [Number]
- **Series/Year**: [Series or Year]
- **Relevant Date(s)**: [Date(s) if applicable]
- **Involved Parties**: [Departments/Stakeholders]
- **Other Notes**: [Any additional key metadata]

## Summary
- [One or more concise bullet points summarizing the main content/action]
"""),
    ("human", "Document:\n\n{content}\n\nPlease follow the instructions above to summarize.")
])


reduce_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an expert synthesizer of educational administrative document summaries. Your role is to create a unified and coherent summary in markdown format based on several extracted summaries.

Instructions:
- **Headline**: Use a synthesized headline that clearly represents the overall document group (include order type/number/year if possible).
- **Merge**: Consolidate overlapping points. Eliminate duplicate or redundant information.
- **Tone**: Keep it neutral and formal.
- **Style**: Use present-tense verbs for consistency (e.g., "Directs", "Authorizes", "Announces").
- **Format**: Markdown only. No extra explanation or commentary.

Use this format:

# [Synthesized Headline]

## Summary
- [List of synthesized, distinct key actions or directives from the grouped summaries]
"""),
    ("human", "Summaries:\n\n{docs}\n\nPlease synthesize the above summaries into a cohesive overview.")
])


import operator
from typing import Annotated, List, Literal, TypedDict

from langchain.chains.combine_documents.reduce import (
    acollapse_docs,
    split_list_of_docs,
)
from langchain_core.documents import Document
from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph
import logging

logger = logging.getLogger(__name__)

# Default model name
TOKEN_MAX = 5000
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
SEPARATOR = ["\n\n", "\n", ".", " ", ""]

summarization_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,           # tokens, or chars if not token-based
    chunk_overlap=CHUNK_OVERLAP,         # overlap between chunks
    separators=SEPARATOR
)

def length_function(documents: List[Document], model_name) -> int:
    return sum(get_llm(model_name).get_num_tokens(doc.page_content) for doc in documents)

class OverallState(TypedDict):
    contents: List[str]
    summaries: Annotated[list, operator.add]
    collapsed_summaries: List[Document]
    final_summary: str
    title: str
    year: int
    tags: List[str]
    model_name: str 

class SummaryState(TypedDict):
    content: str
    model_name: str 


# Nodes:
"""
StateGraph: A specific type of graph in LangGraph that manages the 
state of the application. In this case, the OverallState class 
is used to store the document content, intermediate summaries, 
and the final summary.
"""
# This will be the state of the node that we will "map" all

# Generates a summary for a single chunk of text
async def generate_summary(state: SummaryState):
    model_name = state.get("model_name")
    prompt = map_prompt.invoke({"content": state["content"]})
    logger.info(f"===================================[GENERATE SUMMARY]===================================")
    logger.info(f"Model name: {model_name}")
    logger.info(f"Prompt: {prompt}")
    logger.info(f"===================================[END GENERATE SUMMARY]===================================")
    response = await get_llm(model_name).ainvoke(prompt)

    return {"summaries": [response.content]}

# Here we define the logic to map out over the documents
# We will use this an edge in the graph
def map_summaries(state: OverallState):
    # We will return a list of `Send` objects
    # Each `Send` object consists of the name of a node in the graph
    # as well as the state to send to that node
    model_name = state.get("model_name")
    return [
        Send("generate_summary", {"content": content, "model_name": model_name}) 
        for content in state["contents"]
    ]

# Collects the summaries from all chunks.
def collect_summaries(state: OverallState):
    return {
        "collapsed_summaries": [Document(summary) 
         for summary in state["summaries"]]
    }


async def _reduce(input: dict, model_name) -> str:
    logger.info(f"===================================[REDUCE]===================================")
    logger.info(input)
    logger.info(f"===================================[END REDUCE]===================================")
    prompt = reduce_prompt.invoke({"docs": input})
    response = await get_llm(model_name).ainvoke(prompt)
    return response.content

# Combines the summaries if they exceed a maximum token limit.
async def collapse_summaries(state: OverallState):
    model_name = state.get("model_name")
    doc_lists = split_list_of_docs(
        state["collapsed_summaries"], lambda docs: length_function(docs, model_name), TOKEN_MAX
    )
    results = []
    for doc_list in doc_lists:
        results.append(await acollapse_docs(doc_list, lambda x: _reduce(x, model_name)))

    return {"collapsed_summaries": results}


# Here we will generate the final summary
async def generate_final_summary(state: OverallState):
    model_name = state.get("model_name")
    response = await _reduce(state["collapsed_summaries"], model_name)
    return {"final_summary": response}

# Extracts a title from the final summary
async def generate_title(state: OverallState):
    model_name = state.get("model_name")
    class TitleModel(BaseModel):
        title: str = Field(..., description="A concise, descriptive title in Title Case, excluding institutional identifiers.")

    title_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert at extracting or generating a concise title from a document summary. Follow these guidelines:
- If the summary includes an explicit title or subject line, use it verbatim.
- Otherwise, create a concise title in Title Case, max 10 words.
- Exclude institutional identifiers (e.g., "Office of the...", "Republic of the Philippines", "Mindanao State University", "MSU", "MSU-IIT", "IIT", "Iligan Institute of Technology").
Return only the title text without extra commentary."""),
        ("human", "Summary:\n\n{summary}")
    ])

    prompt = title_prompt | get_llm(model_name).with_structured_output(TitleModel)
    response = await prompt.ainvoke({"summary": state["final_summary"]})
    
    logger.info(f"Extracted title: {response.title}")
    return {"title": response.title}

# Extracts the document year from the final summary
async def extract_year(state: OverallState):
    model_name = state.get("model_name")
    class YearModel(BaseModel):
        year: int = Field(..., description="The four-digit publication year extracted from the document summary.")

    year_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an assistant that extracts the primary publication year from a document summary:
- Identify the four-digit year representing publication or issuance.
- If multiple years appear, select the one most relevant.
"""),
        ("human", "Summary:\n\n{summary}")
    ])

    prompt = year_prompt | get_llm(model_name).with_structured_output(YearModel)
    response = await prompt.ainvoke({"summary": state["final_summary"]})
    
    logger.info(f"Extracted year: {response.year}")
    return {"year": response.year}


# Assigns tags based on the final summary
async def assign_tags(state: OverallState):
    model_name = state.get("model_name")
    
    # Asynchronously fetch all available tags from the database
    @sync_to_async
    def fetch_available_tags():
        return list(Tag.objects.values_list('name', 'description'))
    
    available_tags = await fetch_available_tags()
    formatted_tags = "\n- ".join([f"{name}: {description}" for name, description in available_tags])
    
    tags_prompt = ChatPromptTemplate.from_messages([
        ("system", f"""You are tasked with classifying educational administrative documents by selecting relevant tags from the list below:
- {formatted_tags}
- Other

Guidelines:
- Select tags that are explicitly or implicitly supported by the content.
- If no tags are applicable, choose "Other".
- Provide the tags as a JSON object with the key "tags" and an array of strings, without additional commentary."""),
        ("human", "Summary:\n\n{summary}")
    ])

    class TagsModel(BaseModel):
        tags: list[str] = Field(description="List of relevant document tags")
    
    prompt = tags_prompt | get_llm(model_name).with_structured_output(TagsModel)
    response = await prompt.ainvoke({"summary": state["final_summary"]})
    
    @sync_to_async
    def get_tag_ids(tag_names):
        tag_ids = []
        for tag_name in tag_names:
            tag = Tag.objects.filter(name=tag_name).first()
            if tag:
                tag_ids.append(tag.id)
        return tag_ids
    
    tag_ids = await get_tag_ids(response.tags)
    
    logger.info(f"Tags selected: {response.tags}")
    logger.info(f"Tag IDs: {tag_ids}")
    return {"tags": tag_ids}

def should_collapse(
    state: OverallState,
) -> Literal["collapse_summaries", "generate_final_summary"]:
    model_name = state.get("model_name")
    num_tokens = length_function(state["collapsed_summaries"], model_name)
    if num_tokens > TOKEN_MAX:
        return "collapse_summaries"
    else:
        return "generate_final_summary"

graph = StateGraph(OverallState)
graph.add_node("generate_summary", generate_summary)
graph.add_node("collect_summaries", collect_summaries)
graph.add_node("collapse_summaries", collapse_summaries)
graph.add_node("generate_final_summary", generate_final_summary)
graph.add_node("generate_title", generate_title)
graph.add_node("extract_year", extract_year)
graph.add_node("assign_tags", assign_tags)


# Edges:
graph.add_conditional_edges(START, map_summaries, ["generate_summary"])
graph.add_edge("generate_summary", "collect_summaries")
graph.add_conditional_edges("collect_summaries", should_collapse)
graph.add_conditional_edges("collapse_summaries", should_collapse)
graph.add_edge("generate_final_summary", "generate_title")
graph.add_edge("generate_title", "extract_year")
graph.add_edge("extract_year", "assign_tags")
graph.add_edge("assign_tags", END)

summarization_agent = graph.compile() 