import logging

from ..services.ollama import CHAT_LLM

logger = logging.getLogger(__name__)

class DocumentProcessor:
    @staticmethod
    def generate_title_and_summary(text: str) -> tuple[str, str]:
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
            "- Write the summary in plain Markdown format (e.g., use proper sentence structures without extra markdown symbols unless necessary).\n"
            "- Do not include disclaimers, instructions, or system-related comments.\n\n"
            "**Examples:**\n"
            "**Input Text:** The economic impacts of climate change on coastal cities are significant. Coastal cities face challenges such as rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\n\n"
            "**Output:**\n"
            "Title: Economic Impacts of Climate Change on Coastal Cities\n"
            "Summary: Coastal cities face significant economic challenges due to climate change, including rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\n\n"
            "**Input Text:** The rise of AI and machine learning is transforming industries across the board. AI is revolutionizing industries such as healthcare, finance, and manufacturing. Machine learning is enabling personalized experiences for consumers and improving decision-making in business.\n\n"
            "**Output:**\n"
            "Title: The Impact of AI and Machine Learning on Industries\n"
            "Summary: AI and machine learning are transforming industries by enabling personalized experiences, improving decision-making, and driving innovation.\n\n"
            "Your task: Generate a title and summary for the given input text below."
        )

        json_schema = {
            "title": "title_and_summary",
            "description": "Title and summary generated from input text",
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Concise title reflecting the content",
                    "maxLength": 100
                },
                "summary": {
                    "type": "string",
                    "description": "Markdown formatted summary of the key points",
                }
            },
            "required": ["title", "summary"]
        }
        ai_msg = CHAT_LLM.with_structured_output(json_schema).invoke([
            ("system", system_prompt),
            ("human", f"Text: {text}\n\nProvide the title and summary below:")
        ])
        logger.info("Title and summary generated successfully.")
        return ai_msg.title, ai_msg.summary
