from langchain.text_splitter import RecursiveCharacterTextSplitter


def split_text_into_chunks(text, chunk_size=1000, chunk_overlap=100):
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


def combine_chunks(chunks, chunk_overlap=100):
    """
    Combine text chunks into a single string, removing overlaps.

    Args:
        chunks (list): A list of text chunks.
        chunk_overlap (int): The number of overlapping characters between chunks.

    Returns:
        str: The combined text.
    """
    if not chunks:
        return ""

    print(chunks[0])
    print("---")
    print(chunks[1])

    # Start with the first chunk
    combined_text = chunks[0]

    # Iterate over the remaining chunks
    for i, chunk in enumerate(chunks[1:]):
        # Find overlap between current chunk and previous chunk
        prev_chunk = chunks[i]
        overlap_start = len(prev_chunk) - chunk_overlap if len(prev_chunk) > chunk_overlap else 0
        overlap = prev_chunk[overlap_start:]
        
        # Find where overlap occurs in current chunk
        overlap_pos = chunk.find(overlap)
        if overlap_pos != -1:
            # Only append text after the overlap
            combined_text += chunk[overlap_pos + len(overlap):]
        else:
            # If no overlap found, just append with default overlap
            combined_text += chunk[chunk_overlap:]

    print(combined_text)
    
    return combined_text
