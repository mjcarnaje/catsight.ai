import logging

from django.http import FileResponse, JsonResponse
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from pgvector.django import CosineDistance
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from django.db.models import F
from collections import defaultdict
from .models import Document, DocumentChunk
from .serializers import DocumentChunkSerializer, DocumentSerializer
from .tasks.tasks import (embed_text_task, generate_summary_task,
                          save_chunks_task)
from .utils.upload import UploadUtils

logger = logging.getLogger(__name__)


@api_view(['GET'])
def index(request):
    """
    Retrieve a list of all documents.
    """
    documents = Document.objects.all()
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_doc(request):
    """
    Handle multiple document uploads and initiate OCR and summary generation using Celery tasks.
    """
    uploaded_files = request.FILES.getlist('files')

    if not uploaded_files:
        return Response({"status": "error", "message": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

    response_data = []

    for file in uploaded_files:
        
        serializer = DocumentSerializer(data={'title': file.name})
        
        if serializer.is_valid():
            document = serializer.save(file=None)

            document.file = UploadUtils.upload_document(file, str(document.id))
            
            document.save()

            (save_chunks_task.s(document.id) | 
             generate_summary_task.s() | 
             embed_text_task.s()).delay()

            response_data.append({"status": "success", "id": document.id, "filename": file.name})
        else:
            logger.error(f"Document upload failed for {file.name}: {serializer.errors}")
            response_data.append({"status": "error", "filename": file.name, "errors": serializer.errors})

    # Determine the appropriate status code
    if all(item["status"] == "success" for item in response_data):
        return Response(response_data, status=status.HTTP_201_CREATED)
    elif all(item["status"] == "error" for item in response_data):
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response(response_data, status=status.HTTP_207_MULTI_STATUS)

@api_view(['GET'])
def get_doc(request, doc_id):
    """
    Retrieve a single document by its ID.
    """
    try:
        document= Document.objects.get(id=doc_id)
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
def delete_doc(request, doc_id):
    """
    Delete a document by its ID and remove associated files.
    """
    try:
        document_chunks = DocumentChunk.objects.filter(document=doc_id)
        document_chunks.delete()
        document = Document.objects.get(id=doc_id)
        document.delete()
        return Response({"status": "success", "message": "Document deleted successfully"}, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        return Response({"status": "error", "message": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_doc_chunks(request, doc_id):
    """
    Retrieve the summary chunks for a document by its ID.
    """
    try:
        # Fetch the document by ID
        document = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        # Return a 404 response if the document is not found
        return Response({"status": "error", "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
    
    # Retrieve the chunks associated with the document
    chunks = DocumentChunk.objects.filter(document=document)
    
    # Serialize the chunks
    serializer = DocumentChunkSerializer(chunks, many=True)
    
    # Return the serialized chunks in the response
    return Response(serializer.data)
    

@api_view(['DELETE'])
def delete_doc(request, doc_id):
    """
    Delete a document by its ID and remove associated files.
    """
    try:
        document = Document.objects.get(id=doc_id)
        document_chunks = DocumentChunk.objects.filter(document=doc_id)
        document_chunks.delete()
        UploadUtils.delete_document(doc_id)
        document.delete()
        logger.info(f"Document deleted successfully: {doc_id}")
        return Response({"status": "success", "message": "Document deleted successfully"}, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        logger.warning(f"Document not found: {doc_id}")
        return Response({"status": "error", "message": "Document not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return Response({"status": "error", "message": f"Error deleting document: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def delete_all_docs(request):
    """
    Delete all documents and associated files.
    """
    Document.objects.all().delete()
    DocumentChunk.objects.all().delete()
    UploadUtils.delete_all_documents()
    return Response({"status": "success", "message": "All documents deleted successfully"}, status=status.HTTP_200_OK)


@api_view(['PUT'])
def update_doc(request, doc_id):
    """
    Update the details of a specific document by its ID.
    """
    try:
        document= Document.objects.get(id=doc_id)
        serializer = DocumentSerializer(document, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Documentupdated successfully: {doc_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            logger.warning(f"Documentupdate failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_doc_original_file(request, doc_id):
    """
    Retrieve the original file for a document by its ID.
    """
    try:
        file_path = UploadUtils.get_document_file(doc_id, 'original')
        return FileResponse(open(file_path, 'rb'))
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        return Response({"status": "error", "message": f"Error retrieving {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_doc_ocr_file(request, doc_id):
    """
    Retrieve the OCR file for a document by its ID.
    """
    try:
        logger.info(f"Retrieving OCR file for PDF: {doc_id}")
        file_path = UploadUtils.get_document_file(doc_id, 'ocr')
        return FileResponse(open(file_path, 'rb'))
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        return Response({"status": "error", "message": f"Error retrieving {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 

@api_view(['POST'])
def search_docs(request):
    """
    Search documents using vector similarity and optional keyword filtering.
    """
    try:
        query = request.data.get('query')
        filters = request.data.get('filters', {})
        limit = int(request.data.get('limit', 10))

        if not query:
            return Response(
                {"error": "Query parameter is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate embedding for the search query
        model = OllamaEmbeddings(model="bge-m3")
        query_embedding = model.embed_query(query)

        # Start with base queryset
        chunks_queryset = DocumentChunk.objects.all()

        # Apply any text-based filters
        if filters.get('title'):
            chunks_queryset = chunks_queryset.filter(
                document__title__icontains=filters['title']
            )

        # Perform vector similarity search
        results = chunks_queryset.order_by(
            CosineDistance('embedding_vector', query_embedding)
        )[:limit]

        # Format response
        response_data = []
        for chunk in results:
            response_data.append({
                'document_id': chunk.document.id,
                'document_title': chunk.document.title,
                'chunk_index': chunk.index,
                'content': chunk.content,
                'created_at': chunk.document.created_at,
            })

        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return Response(
            {"error": f"Search failed: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def chat_with_docs(request):
    """
    Chat with documents using vector search and LLM.
    """
    query = request.data.get('query')
    if not query:
        return Response(
            {"error": "Query parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Generate embedding for the search query
        embedding_model = OllamaEmbeddings(model="bge-m3")
        query_embedding = embedding_model.embed_query(query)

        # Perform vector similarity search
        chunks_with_similarity = DocumentChunk.objects.annotate(
            cosine_similarity=CosineDistance(F('embedding_vector'), query_embedding)
        ).order_by('-cosine_similarity')

        if not chunks_with_similarity.exists():
            return Response(
                {"error": "No relevant documents found for the query."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Limit to top N chunks
        initial_top_k = 100
        top_chunks = list(chunks_with_similarity[:initial_top_k])

        # Group chunks by document and sum their similarities
        doc_scores = defaultdict(float)
        doc_chunks = defaultdict(list)

        for chunk in top_chunks:
            doc_id = chunk.document.id
            similarity = chunk.cosine_similarity
            doc_scores[doc_id] += similarity
            doc_chunks[doc_id].append((chunk, similarity))

        # Re-rank documents based on cumulative similarity
        ranked_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)

        # Apply similarity difference threshold
        top_score = ranked_docs[0][1]
        similarity_threshold = 0.7 * top_score  # Adjust threshold as necessary
        filtered_docs = [doc for doc in ranked_docs if doc[1] >= similarity_threshold]

        if not filtered_docs:
            return Response(
                {"error": "No documents passed the similarity threshold."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Select top N documents after filtering
        top_doc_ids = [doc_id for doc_id, score in filtered_docs[:5]]  # Adjust number of documents as needed

        # Collect chunks from top documents
        final_chunks = []
        for doc_id in top_doc_ids:
            chunks = doc_chunks[doc_id]
            # Optionally, sort chunks within a document
            chunks.sort(key=lambda x: -x[1])  # Sort by similarity descending
            final_chunks.extend([chunk for chunk, sim in chunks])

        # Prepare context from final chunks
        context = "\n\n".join(
            f"From Document '{chunk.document.title}':\n{chunk.content}"
            for chunk in final_chunks
        )

        # Improve the prompt
        prompt_template = """
You are an expert assistant helping to answer questions based on the provided document excerpts. Use the context below to answer the user's question. Be concise, and if you use information from a document, please mention its title.

Context:
{context}

Question:
{question}

Answer:"""

        # Setup LLM
        llm = OllamaLLM(model="llama3.2")

        # Generate LLM response
        prompt = prompt_template.format(context=context, question=query)
        response_text = llm(prompt)

        # Format response data
        response_data = {
            'answer': response_text.strip(),
            'sources': [
                {
                    'document_id': doc_id,
                    'document_title': Document.objects.get(id=doc_id).title,
                    'total_similarity': doc_scores[doc_id],
                    'chunks': [
                        {
                            'chunk_index': chunk.index,
                            'content': chunk.content,
                            'similarity': sim
                        } for chunk, sim in doc_chunks[doc_id]
                    ]
                } for doc_id in top_doc_ids
            ]
        }

        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return Response(
            {"error": f"Chat failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
