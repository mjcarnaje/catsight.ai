import logging
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from ..services.ollama import OLLAMA_CHAT

logger = logging.getLogger(__name__)

# Define the schema using Pydantic
class TitleSummary(BaseModel):
    title: str = Field(..., description="Concise title reflecting the content", max_length=100)
    summary: str = Field(..., description="Markdown formatted summary of the key points")

class DocumentProcessor:
    @staticmethod
    def generate_information(text: str) -> tuple[str, str]:
        logger.info("Generating title and summary for text: %s", text)
        
        system_prompt = (
            "You are an advanced text processing assistant tasked with analyzing the provided text to extract its main ideas and generate a concise, descriptive title and a well-structured summary. Your outputs must strictly adhere to the following rules:\n\n"
            "**Title Guidelines:**\n"
            "- Clearly and accurately reflect the content of the text.\n"
            "- Use plain language without special characters or symbols.\n"
            "- Limit to a maximum of 100 characters.\n"
            "- Capitalize the title in title case.\n"
            "- Return only the title text without any labels or additional text.\n\n"
            "**Summary Guidelines:**\n"
            "- Ensure the summary retains the original meaning and context.\n"
            "- Highlight the most important points and main ideas only.\n"
            "- Use professional, clear, and concise language.\n"
            "- Organize the information logically for readability.\n"
            "- Avoid any redundant or unnecessary details.\n"
            "- Write the summary in plain Markdown format.\n"
            "- Do not include disclaimers, instructions, or system-related comments.\n\n"
            "**Examples:**\n"
            "Input Text: The economic impacts of climate change on coastal cities are significant. Coastal cities face challenges such as rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\n"
            "Output:\n"
            "Title: Economic Impacts of Climate Change on Coastal Cities\n"
            "Summary: Coastal cities face significant economic challenges due to climate change, including rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\n"
            "Your task: Generate a title and summary for the given input text below."
        )

        llm = OLLAMA_CHAT
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Text: {text}\n\nProvide the title and summary below:")
        ]

        # Use the Pydantic model for structured output
        structured_llm = llm.with_structured_output(TitleSummary)
        ai_msg = structured_llm.invoke(messages)

        logger.info("Title and summary generated successfully.")
        return ai_msg.title, ai_msg.summary
