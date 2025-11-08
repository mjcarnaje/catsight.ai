from langchain_text_splitters import RecursiveCharacterTextSplitter


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

    return combined_text


def make_snippet(text: str, keyword: str, radius: int = 50) -> str:
    """
    Returns ~2*radius chars around the first occurrence of keyword.
    """
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        snippet = text[:radius * 2]
        return snippet + ("…" if len(text) > len(snippet) else "")
    start = max(0, idx - radius)
    end = min(len(text), idx + len(keyword) + radius)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet