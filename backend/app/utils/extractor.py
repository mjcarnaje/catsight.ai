import re
from pdfminer.high_level import extract_text
from semchunk import chunkerify
import tiktoken

def extract_text_from_pdf(file_path):
    """
    Extract text from a PDF file using pdfminer.six.

    Args:
        file_path (str): The path to the PDF file.

    Returns:
        str: The extracted text.
    """
    return extract_text(file_path)

def clean_extracted_text(text):
    """
    Clean the extracted text by removing unwanted characters and formatting issues.

    Args:
        text (str): The raw extracted text.

    Returns:
        str: The cleaned text.
    """
    # Remove hyphenated line breaks
    text = re.sub(r'-\n', '', text)
    # Replace multiple newlines with a space
    text = re.sub(r'\n+', ' ', text)
    # Remove LaTeX-like commands and special characters
    text = re.sub(r'/[A-Za-z]+', '', text)
    text = re.sub(r'[^A-Za-z0-9 .,!?\'"-]+', '', text)
    # Remove extra spaces
    return ' '.join(text.split())

def contains_concatenated_words(text):
    """
    Check if the text contains concatenated words (heuristic).

    Args:
        text (str): The text to check.

    Returns:
        bool: True if concatenated words are detected, False otherwise.
    """
    return any(len(word) > 15 for word in text.split())

def fix_concatenated_words(text):
    """
    Use TextBlob to correct concatenated words and spelling errors.

    Args:
        text (str): The text with potential concatenated words.

    Returns:
        str: The text with corrected words.
    """
    from textblob import TextBlob
    corrected_text = str(TextBlob(text).correct())
    return corrected_text

def split_text_into_chunks(text, chunk_size=3000, chunk_overlap=300):
    """
    Split text into semantically meaningful chunks using semchunk.

    Args:
        text (str): The text to split.
        chunk_size (int): The maximum size of each chunk in tokens.
        chunk_overlap (int): The number of tokens to overlap between chunks.

    Returns:
        list: A list of text chunks.
    """
    # Initialize the tokenizer for the desired model
    tokenizer = tiktoken.encoding_for_model('gpt-4')
    # Create the chunker using semchunk
    chunker = chunkerify(tokenizer, chunk_size - chunk_overlap)
    # Split the text into chunks
    chunks = chunker(text)
    return chunks
