import logging
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from ..services.ollama import LLAMA_CHAT

logger = logging.getLogger(__name__)

# Define the schema using Pydantic
class TitleSummary(BaseModel):
    title: str = Field(..., description="Descriptive title reflecting the content", max_length=200)
    summary: str = Field(..., description="Markdown formatted comprehensive summary of the content")
    year: int = Field(..., description="Year of the document")
    tags: list[str] = Field(..., description="Tags for the document")

class DocumentProcessor:
    @staticmethod
    def get_full_information(text: str) -> TitleSummary:
        """Returns the complete TitleSummary object with title, summary, year, and tags"""
        logger.info("Generating complete document information")
        
        system_prompt = """
            You are an advanced text processing assistant tasked with analyzing the provided text to extract its main ideas and generate the following structured outputs:

            1. **Title** – A descriptive and informative title.
            2. **Summary** – A comprehensive and well-structured summary in Markdown format.
            3. **Tags** – Relevant classification tags based on document type or topic.
            4. **Year** – The year the document was written or published (extract from text if mentioned, otherwise infer if possible).

            Follow these strict formatting and content guidelines:

            ### Title Guidelines:
            - If the document already contains a clear title or subject line, use that exact title.
            - If no title exists, create a descriptive title that accurately reflects the content.
            - Use plain language (no emojis or special symbols).
            - Limit to a maximum of 200 characters.
            - Use Title Case (capitalize main words).
            - Be specific rather than generic when creating a title.

            ### Summary Guidelines:
            - Provide a comprehensive summary that captures all key points and important details.
            - Retain the original meaning, context, and significant information.
            - Include major points, arguments, findings, and conclusions when present.
            - Use clear, professional language organized in a logical structure.
            - Use plain Markdown for formatting (headings, lists, etc.) to enhance readability.
            - Avoid any redundant phrases, disclaimers, or system-related comments.
            - The summary should be thorough enough that someone can understand all main points without reading the original.

            ### Tag Guidelines:
            - Identify 1 to 5 relevant tags that describe the document type or content.
            - Tags should be concise, descriptive, and selected from categories such as:
            - Special Orders
            - Memorandums
            - University Circulars
            - Academic Calendars
            - Board Resolutions
            - University Announcements
            - Student Policies
            - Faculty Directives
            - Administrative Notices
            - Campus Bulletins
            - Travel Orders
            - Other MSU-IIT Administrative Documents

            ### Year Guidelines:
            - Extract the year explicitly mentioned in the document.
            - If multiple years are mentioned, choose the most relevant one.
            - If not directly stated, reasonably infer from the context.

            Your task: Generate the **title**, **summary**, **year**, and **tags** for the following text:
        """
        
        llm = LLAMA_CHAT
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Text: {text}")
        ]

        # Use the Pydantic model for structured output
        structured_llm = llm.with_structured_output(TitleSummary)
        ai_msg = structured_llm.invoke(messages)

        logger.info("Complete document information generated successfully.")
        return ai_msg
