from PyPDF2 import PdfReader
import logging
import io
from typing import List, Tuple
import re

logger = logging.getLogger(__name__)

class DocTextExtractor:
    @staticmethod
    def extract_text_from_doc(file_content: bytes, max_words_per_chunk: int = 2500) -> Tuple[List[str], str]:
        """
        Extracts text from a Document file's content and splits it into chunks suitable for vector embeddings.
        It handles large Documents by smartly splitting text into manageable chunks without breaking sentences.

        Args:
            file_content: The content of the Document file in bytes.
            max_words_per_chunk: The maximum number of words in each text chunk.

        Returns:
            A tuple containing:
            - A list of strings, where each string is a text chunk suitable for embeddings.
            - The full text of the Documentas a single string.
        """

        logger.info("Starting text extraction from Document")
        doc_file = io.BytesIO(file_content)
        reader = PdfReader(doc_file)
        
        # Extract text page by page to handle large Documents efficiently
        full_text = ''
        for page_num, page in enumerate(reader.pages, 1):
            logger.debug(f"Extracting text from page {page_num}")
            try:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + '\n'
                else:
                    logger.debug(f"No text found on page {page_num}")
            except Exception as e:
                logger.error(f"Error extracting text from page {page_num}: {e}")

        total_words = len(re.findall(r'\b\w+\b', full_text))
        logger.debug(f"Total text extracted: {total_words} words")

        # Split text into chunks smartly
        texts = DocTextExtractor.smart_split(full_text, max_words_per_chunk)

        logger.info(f"Finished text extraction. Extracted {len(texts)} text chunks.")
        return texts, full_text

    @staticmethod
    def smart_split(text: str, max_words_per_chunk: int) -> List[str]:
        """
        Splits the text into chunks of maximum size, attempting to split at sentence boundaries.

        Args:
            text: The full text to split.
            max_words_per_chunk: The maximum number of words in each chunk.

        Returns:
            A list of text chunks.
        """

        # Improved regex for splitting sentences
        sentence_endings = re.compile(
            r'''(?<!\b\w\.\w\.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s''', re.VERBOSE)
        sentences = sentence_endings.split(text)
        chunks = []
        current_chunk = []
        current_chunk_word_count = 0

        for sentence in sentences:
            # Tokenize sentence into words
            sentence_words = re.findall(r'\b\w+\b', sentence)
            sentence_word_count = len(sentence_words)

            if current_chunk_word_count + sentence_word_count <= max_words_per_chunk:
                current_chunk.append(sentence)
                current_chunk_word_count += sentence_word_count
            else:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    logger.debug(f"Created chunk of {current_chunk_word_count} words")
                current_chunk = [sentence]
                current_chunk_word_count = sentence_word_count

        # Add the last chunk
        if current_chunk:
            chunks.append(' '.join(current_chunk))
            logger.debug(f"Created final chunk of {current_chunk_word_count} words")

        return chunks
