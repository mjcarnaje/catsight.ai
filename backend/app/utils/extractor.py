from langchain.text_splitter import RecursiveCharacterTextSplitter


def split_text_into_chunks(text, chunk_size=3000, chunk_overlap=300):
    """
    Split text into chunks using LangChain's RecursiveCharacterTextSplitter.

    Args:
        text (str): The text to split.
        chunk_size (int): The maximum size of each chunk in tokens.
        chunk_overlap (int): The number of tokens to overlap between chunks.

    Returns:
        list: A list of text chunks.
    """
    
    # Create text splitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    # Split the text into chunks
    chunks = text_splitter.split_text(text)
    
    return chunks
