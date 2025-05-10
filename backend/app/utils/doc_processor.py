from enum import Enum
from typing import List
import logging
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from ..services.ollama import LLAMA_CHAT
from langchain_community.chat_models import ChatOpenAI
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain

logger = logging.getLogger(__name__)

class TagEnum(str, Enum):
    SPECIAL_ORDERS = "Special Orders"
    MEMORANDUMS = "Memorandums"
    UNIVERSITY_CIRCULARS = "University Circulars"
    ACADEMIC_CALENDARS = "Academic Calendars"
    BOARD_RESOLUTIONS = "Board Resolutions"
    UNIVERSITY_ANNOUNCEMENTS = "University Announcements"
    STUDENT_POLICIES = "Student Policies"
    FACULTY_DIRECTIVES = "Faculty Directives"
    ADMINISTRATIVE_NOTICES = "Administrative Notices"
    CAMPUS_BULLETINS = "Campus Bulletins"
    TRAVEL_ORDERS = "Travel Orders"
    OTHER = "Other"

class DocumentProcessor:
    @staticmethod
    def get_title(docs: List[Document]) -> str:
        """Returns a descriptive title for the document"""
        logger.info("Generating document title")
        
        system_prompt = """
            You are an advanced text processing assistant tasked with analyzing the provided text to extract or create a title.

            ### Title Guidelines:
            - If the document already contains a clear title or subject line, use that exact title.
            - If no title exists, create a descriptive title that accurately reflects the content.
            - Use plain language (no emojis or special symbols).
            - Limit to a maximum of 200 characters.
            - Use Title Case (capitalize main words).
            - Be specific rather than generic when creating a title.
            - If you found a subject line, use that as the title.
            - Please avoid the term "Office of the *", "Republic of the Philippines", "Mindanao State University", "MSU", "MSU-IIT", "IIT", "Iligan Institute of Technology", "ILIGAN INSTITUTE OF TECHNOLOGY", "Mindanao State University", "MSU", "MSU-IIT", "Office of the*"
            Your task: Generate ONLY the title for the following text. Return just the title with no additional text or explanation.

            Context:
            {context}
        """
        logger.info(f"Processing {len(docs)} documents for title generation")
        prompt = ChatPromptTemplate.from_template(system_prompt)
        chain = create_stuff_documents_chain(LLAMA_CHAT, prompt)
        title = chain.invoke({"context": docs})
        logger.info(f"Title generated: {title}")

        # Clean the title

        class Title(BaseModel):
            title: str = Field(description="The title of the document")

        system_message = f"""
            You are an advanced clean up assistant tasked with cleaning up the title of a document.
        
            - IMPORTANT: DO NOT include the following terms in the title as they are redundant:
              * "IIT"
              * "Iligan Institute of Technology"
              * "ILIGAN INSTITUTE OF TECHNOLOGY"
              * "Mindanao State University"
              * "MSU" 
              * "MSU-IIT"
              * "Office of the*"
              * "Republic of the Philippines"
              * Any other variants of the institution name
            - If the title contains these terms, remove them or replace with more specific content details.
        """

        title = LLAMA_CHAT.with_structured_output(Title).invoke(system_message + title)
        logger.info(f"Cleaned title: {title.title}")
        return title.title.strip()

    @staticmethod
    def get_summary(docs: List[Document]) -> str:
        """Returns a comprehensive summary of the document content"""
        logger.info("Generating document summary")
        
        system_prompt = """
            You are an advanced text processing assistant tasked with analyzing the provided text to generate a comprehensive summary.

            ### Summary Guidelines:
            - Provide a highly detailed and comprehensive summary that captures all key points and important details.
            - The summary MUST be limited to a maximum of 500 words.
            - Retain the original meaning, context, and significant information.
            - Include major points, arguments, findings, and conclusions when present.
            - Use clear, professional language organized in a logical structure.
            - Use plain Markdown for formatting (headings, lists, etc.) to enhance readability.
            - Avoid any redundant phrases, disclaimers, or system-related comments.
            - The summary should be thorough enough that someone can understand all main points without reading the original.

            Your task: Generate ONLY the summary in Markdown format for the following text. Return just the summary with no additional text or explanation.

            Context:
            {context}
        """
        logger.info(f"Processing {len(docs)} documents for summary generation")
        prompt = ChatPromptTemplate.from_template(system_prompt)
        chain = create_stuff_documents_chain(LLAMA_CHAT, prompt)
        summary = chain.invoke({"context": docs})
        logger.info("Summary generated successfully")
        return summary.strip()

    @staticmethod
    def get_year(docs: List[Document]) -> int:
        """Returns the year of the document"""
        logger.info("Generating document year")
        
        system_prompt = """
            You are an advanced text processing assistant tasked with analyzing the provided text to determine the year.

            ### Year Guidelines:
            - Extract the year explicitly mentioned in the document.
            - If multiple years are mentioned, choose the most relevant one (usually publication year).
            - If not directly stated, reasonably infer from the context.
            - Return ONLY a four-digit year (e.g., 2023).

            Your task: Extract or infer the year for the following text. Return just the four-digit year with no additional text or explanation.

            Context:
            {context}
        """
        logger.info(f"Processing {len(docs)} documents for year extraction")
        prompt = ChatPromptTemplate.from_template(system_prompt)
        chain = create_stuff_documents_chain(LLAMA_CHAT, prompt)
        year_str = chain.invoke({"context": docs})
        try:
            year = int(year_str.strip())
            logger.info(f"Year extracted: {year}")
            return year
        except ValueError:
            logger.error(f"Invalid year format returned: {year_str}")
            # Default to current year if extraction fails
            from datetime import datetime
            current_year = datetime.now().year
            logger.info(f"Using current year as fallback: {current_year}")
            return current_year

    @staticmethod
    def get_tags(summary: str) -> List[TagEnum]:
        """Returns relevant tags for the document"""
        logger.info("Generating document tags")
        class Tags(BaseModel):
            tags: List[TagEnum] = Field(description="List of valid tags that apply to this document")

        system_message = f"""
            You are an advanced text processing assistant tasked with analyzing the provided text to generate a list of tags.

            Available Tags:
              1. Special Orders
              2. Memorandums
              3. University Circulars
              4. Academic Calendars
              5. Board Resolutions
              6. University Announcements
              7. Student Policies
              8. Faculty Directives
              9. Administrative Notices
              10. Campus Bulletins
              11. Travel Orders
              12. Other
            
            Guidelines:
            - Select tags that exactly match the provided options.
            - Normalize any variations to match the correct tag format (e.g., "SPECIAL ORDER No. 2002-164" should be "Special Orders").
            - Exclude any extraneous details not relevant to the tag names.
            - Ensure at least one tag is selected; use "Other" if no specific tags fit.
            - Assign multiple tags only if the content clearly justifies it.
            
            Provide the list of normalized tags.
        """

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            ("human", "{summary}")
        ])

        runnable = prompt | LLAMA_CHAT.with_structured_output(schema=Tags)

        tags = runnable.invoke({"summary": summary})
        logger.info(f"Tags assigned: {tags.tags}")
        return tags.tags
