import os
import logging
from django.conf import settings
from django.core.files.storage import default_storage
from ocrmypdf import ocr
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
import PyPDF2
import io
import shutil

logger = logging.getLogger(__name__)

class PDFUtils:
    @staticmethod
    def upload_pdf(file, title):
        filename = default_storage.get_available_name(file.name)
        upload_path = os.path.join('pdfs', filename)
        file_path = default_storage.save(upload_path, file)
        return file_path
        
    @staticmethod
    def make_description(pdf_instance):
        model = OllamaLLM(model='llama3.2')

        summary_template = (
            "You are an expert at analyzing and summarizing PDF content. "
            "Given the following extracted text from a PDF document: {text}\n\n"
            "Please provide a detailed summary of the PDF content, adhering to these guidelines:\n"
            "1. The summary should be between 200-300 words.\n"
            "2. Capture the main ideas, key arguments, and essential information from the document.\n"
            "3. Organize the summary in a logical flow, maintaining the document's original structure.\n"
            "4. Use clear, concise language without technical jargon unless absolutely necessary.\n"
            "5. Do not include your own opinions or interpretations; stick to the facts presented.\n"
            "6. If the document contains data or statistics, include the most significant ones.\n\n"
            "Present your summary as plain text, without any special formatting or markdown."
        )

        title_template = (
            "You are an expert at generating titles from descriptions. "
            "Given the following description: {description}\n\n"
            "Please provide a concise title for the PDF document, adhering to these guidelines:\n"
            "1. The title should be between 5-10 words.\n"
            "2. Capture the main idea or theme of the document.\n"
            "3. Use clear, concise language without technical jargon unless absolutely necessary.\n"
            "4. Do not include your own opinions or interpretations; stick to the facts presented.\n"
            "5. If the document contains data or statistics, include the most significant ones.\n\n"
            "Present your title as plain text, without any special formatting or markdown."
        )

        logger.info(f"Starting description generation for PDF: {pdf_instance.id}")
        if not pdf_instance.ocr_file:
            logger.error(f"OCR file not found for PDF: {pdf_instance.id}")
            return "Error: OCR file not found"

        try:
            text = PDFUtils.extract_text_from_pdf(pdf_instance)
            description = PDFUtils.generate_description(model, summary_template, text, pdf_instance.id)
            title = PDFUtils.generate_title(model, title_template, description, pdf_instance.id)

            pdf_instance.description = description
            pdf_instance.title = title
            pdf_instance.status = "completed"
            pdf_instance.save()

            logger.info(f"PDF description and title generated and saved for: {pdf_instance.id}")
            return description
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_instance.id}: {str(e)}")
            return f"Error: {str(e)}"

    @staticmethod
    def extract_text_from_pdf(pdf_instance):
        logger.debug(f"Reading OCR file for PDF: {pdf_instance.id}")
        pdf_content = pdf_instance.ocr_file.read()
        pdf_file = io.BytesIO(pdf_content)

        logger.debug(f"Extracting text from PDF: {pdf_instance.id}")
        reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page_num, page in enumerate(reader.pages, 1):
            logger.debug(f"Extracting text from page {page_num} of PDF: {pdf_instance.id}")
            text += page.extract_text() + "\n"

        max_chars = 10000
        if len(text) > max_chars:
            logger.info(f"Truncating text for PDF: {pdf_instance.id} (original length: {len(text)} chars)")
            text = text[:max_chars] + "..."

        return text

    @staticmethod
    def generate_description(model, template, text, pdf_id):
        logger.info(f"Generating description for PDF: {pdf_id}")
        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | model
        description = chain.invoke({"text": text})
        logger.debug(f"Generated description: {description}")
        return description

    @staticmethod
    def generate_title(model, template, description, pdf_id):
        logger.info(f"Generating title for PDF: {pdf_id}")
        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | model
        title = chain.invoke({"description": description})
        logger.debug(f"Generated title: {title}")
        return title
          
    @staticmethod
    def ocr_pdf(pdf_instance):
        input_path = pdf_instance.file.path
        output_filename = f"ocr_{os.path.basename(input_path)}"
        output_path = os.path.join(settings.MEDIA_ROOT, 'pdfs', 'ocr', output_filename)
        
        logger.info(f"Starting OCR for PDF: {input_path}")
        logger.info(f"Output path: {output_path}")

        try:
            if not os.path.exists(input_path):
                raise FileNotFoundError(f"Input file not found: {input_path}")

            # Check if the PDF already contains text
            with open(input_path, 'rb') as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                has_text = any(page.extract_text().strip() for page in pdf_reader.pages)

            if has_text:
                logger.info(f"PDF already contains text, skipping OCR: {input_path}")
                # Copy the original file to the OCR output path
                shutil.copy(input_path, output_path)
            else:
                ocr(input_path, output_path, progress_bar=False)
            
            if not os.path.exists(output_path):
                raise FileNotFoundError(f"Output file not created: {output_path}")

            with open(output_path, 'rb') as ocr_file:
                pdf_instance.ocr_file.save(output_filename, ocr_file)

            logger.info(f"Process completed successfully for PDF: {input_path}")
            pdf_instance.save()
        except FileNotFoundError as e:
            pdf_instance.status = "failed"
            logger.error(f"File not found: {str(e)}")
        except Exception as e:
            pdf_instance.status = "failed"
            logger.error(f"Processing failed: {str(e)}")
        
        pdf_instance.save()
