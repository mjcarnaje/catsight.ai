from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
import logging

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Handles text processing and summary generation for documents.
    """

    @staticmethod
    def generate_summary(text: str) -> str:
        """
        Generate a detailed summary of the provided text using a language model.

        Args:
            text: The text extracted from the document

        Returns:
            A summary string.
        """
        model = OllamaLLM(model='llama3.2')
        summary_template = (
            "Analyze and summarize the following text from a document: {text}\n\n"
            "Provide a concise yet comprehensive summary that directly addresses the content. "
            "Focus on main ideas, key points, and essential information. "
            "Structure the summary clearly to capture the document's essence. "
            "Do not use any introductory phrases or markdown syntax."
        )
        prompt = ChatPromptTemplate.from_template(summary_template)
        description = (prompt | model).invoke({"text": text})
        logger.info("Summary generated successfully.")
        return description

    @staticmethod
    def generate_title(description: str) -> str:
        """
        Generate a title for the document based on its description.

        Args:
            description: The description generated for the document content.
        Returns:
            A title string.
        """
        model = OllamaLLM(model='llama3.2')
        title_template = (
            "You are an expert at generating titles from descriptions. "
            "Based on the following summary of a document: {description}\n\n"
            "Please create a short, concise, and informative title that accurately represents the content. "
            "The title should be no more than 10 words long and should not use any markdown syntax."
        )
        prompt = ChatPromptTemplate.from_template(title_template)
        title = (prompt | model).invoke({"description": description})
        logger.info("Title generated successfully.")
        return title
