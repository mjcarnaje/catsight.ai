import logging

from ..services.ollama import CHAT_LLM

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Handles text processing, including summary and title generation for documents.
    """

    @staticmethod
    def generate_summary(text: str) -> str:
        system_prompt = (
            "You are a professional text summarizer. Read the following document text carefully and produce a concise yet comprehensive summary.\n\n"
            "# Summary Guidelines\n\n"
            "- Do not include any system or user instructions, disclaimers, or references to how you were prompted\n"
            "- Maintain the original meaning and context of the text\n" 
            "- Focus on the key points and main ideas\n"
            "- Use clear and professional language\n"
            "- Keep the summary concise but informative\n"
            "- Organize information in a logical flow\n"
            "- Avoid redundancy and unnecessary details"
            "- Do not include any system or user instructions, disclaimers, or references to how you were prompted"
            "- The output should be in markdown format"
            "- You will be given a text to summarize, and you will return the summary in markdown format. Do not include any system or user instructions, disclaimers, or references to how you were prompted"
        )

        ai_msg = CHAT_LLM.invoke([
            ("system", system_prompt),
            ("human", f"Here is the text to summarize: {text}"),
        ])
        logger.info(f"ai_msg: {ai_msg}")
        logger.info("Summary generated successfully.")
        logger.info(f"Summary: {ai_msg.content}")
        return ai_msg.content

    @staticmethod
    def generate_title(summary: str) -> str:
        system_prompt = (
            "You are a professional title creator. Based on the provided summary, generate a concise, descriptive, and clear title that adheres to the following guidelines:\n"
            "- Reflect the content of the summary accurately.\n"
            "- Use plain text without formatting or special characters.\n" 
            "- Limit the title to a maximum of 100 characters.\n"
            "- Present the title in title case capitalization.\n"
            "- Return only the title text without labels or prefixes.\n\n"
            "Example:\n"
            "Summary: A comprehensive analysis of the economic impacts of climate change on coastal cities.\n"
            "Output: Economic Impacts of Climate Change on Coastal Cities"
        )
        ai_msg = CHAT_LLM.invoke([
            ("system", system_prompt),
            ("human", f"Here is the summary to generate a title from: {summary}"),
        ])
        logger.info(f"ai_msg: {ai_msg}")
        logger.info("Title generated successfully.")
        logger.info(f"Title: {ai_msg.content}")
        return ai_msg.content

    @staticmethod
    def generate_title_and_summary(text: str) -> tuple[str, str]:
        system_prompt = (
            "You are a professional text analyzer. Based on the provided text, generate both a title and summary that adhere to the following guidelines:\n\n"
            "Title Guidelines:\n"
            "- Reflect the content accurately\n"
            "- Use plain text without formatting or special characters\n"
            "- Limit to 100 characters maximum\n"
            "- Use title case capitalization\n"
            "- Return only the title text without labels\n\n"
            "Summary Guidelines:\n"
            "- Do not include any system instructions or disclaimers\n"
            "- Maintain the original meaning and context\n"
            "- Focus on key points and main ideas\n"
            "- Use clear and professional language\n"
            "- Keep the summary concise but informative\n"
            "- Organize information logically\n"
            "- Avoid redundancy and unnecessary details\n"
            "- Format the summary in markdown"
            "Example:\n"
            "Text: The economic impacts of climate change on coastal cities are significant. Coastal cities face challenges such as rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\n"
            "Output:\n"
            "Title: Economic Impacts of Climate Change on Coastal Cities\n"
            "Summary: Coastal cities face significant economic challenges due to climate change, including rising sea levels, increased storm damage, and loss of infrastructure. Governments and businesses must adapt to these changes to mitigate future risks.\"\n\n"
            "Example:\n"
            "Text: The rise of AI and machine learning is transforming industries across the board. AI is revolutionizing industries such as healthcare, finance, and manufacturing. Machine learning is enabling personalized experiences for consumers and improving decision-making in business.\n"
            "Output:\n"
            "Title: The Impact of AI and Machine Learning on Industries\n"
            "Summary: AI and machine learning are transforming industries by enabling personalized experiences, improving decision-making, and driving innovation."
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