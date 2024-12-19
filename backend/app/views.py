import logging
from collections import defaultdict

from celery import chain
from celery.result import AsyncResult
from django.db.models import F
from django.http import FileResponse, StreamingHttpResponse
from langchain_ollama import ChatOllama, OllamaEmbeddings
from pgvector.django import CosineDistance
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .constant import DocumentStatus
from .models import Document, DocumentChunk
from .serializers import DocumentChunkSerializer, DocumentSerializer
from .tasks.tasks import (embed_text_task, generate_summary_task,
                          save_chunks_task)
from .utils.doc_processor import DocumentProcessor
from .utils.extractor import combine_chunks
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
            
            task_chain = chain(
                save_chunks_task.s(document.id),
                generate_summary_task.s(),
                embed_text_task.s()
            )

            result = task_chain.apply_async()
            document.task_id = result.id
            document.save()

            response_data.append({"status": "success", "id": document.id, "filename": file.name})
        else:
            logger.error(f"Document upload failed for {file.name}: {serializer.errors}")
            response_data.append({"status": "error", "filename": file.name, "errors": serializer.errors})

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
    

@api_view(['GET'])
def get_doc_raw(request, doc_id):
    """
    Retrieve the raw content of a document by its ID.
    """
    document = Document.objects.get(id=doc_id)
    file_path = UploadUtils.get_document_file(doc_id, 'original')
    return FileResponse(open(file_path, 'rb'))

@api_view(['GET'])  
def get_doc_markdown(request, doc_id):
    """
    Retrieve the markdown content of a document by its ID.
    Handles overlapping chunks by removing duplicate content.
    """
    try:
        document = Document.objects.get(id=doc_id)
        chunks = DocumentChunk.objects.filter(document=document).order_by('index')
        
        combined_text = combine_chunks(chunks.values_list('content', flat=True))
       
        return Response({"content": combined_text}, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        logger.warning(f"Document not found: {doc_id}")
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )


def revoke_task(task_id):
    """Helper function to revoke a Celery task"""
    if task_id:
        try:
            AsyncResult(task_id).revoke(terminate=True)
            logger.info(f"Task {task_id} revoked successfully")
        except Exception as e:
            logger.error(f"Error revoking task {task_id}: {str(e)}")

@api_view(['DELETE'])
def delete_doc(request, doc_id):
    """
    Delete a document by its ID, cancel any running tasks, and remove associated files.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        # Revoke any running tasks
        revoke_task(document.task_id)
        
        # Delete associated chunks
        document_chunks = DocumentChunk.objects.filter(document=doc_id)
        document_chunks.delete()
        
        # Delete files and document
        UploadUtils.delete_document(doc_id)
        document.delete()
        
        logger.info(f"Document deleted successfully: {doc_id}")
        return Response(
            {"status": "success", "message": "Document deleted successfully"}, 
            status=status.HTTP_200_OK
        )
    except Document.DoesNotExist:
        logger.warning(f"Document not found: {doc_id}")
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error deleting document: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_doc_chunks(request, doc_id):
    """
    Retrieve the summary chunks for a document by its ID.
    """
    try:
        document = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({"status": "error", "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
    
    chunks = DocumentChunk.objects.filter(document=document)
    
    serializer = DocumentChunkSerializer(chunks, many=True)
    
    return Response(serializer.data)
    

@api_view(['DELETE'])
def delete_all_docs(request):
    """
    Delete all documents, cancel running tasks, and remove associated files.
    """
    try:
        # Revoke all running tasks for all documents
        documents = Document.objects.all()
        for doc in documents:
            revoke_task(doc.task_id)
        
        # Delete all documents and chunks
        Document.objects.all().delete()
        DocumentChunk.objects.all().delete()
        
        # Delete all files
        UploadUtils.delete_all_documents()
        
        return Response(
            {"status": "success", "message": "All documents deleted successfully"}, 
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"Error deleting all documents: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error deleting all documents: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
        model = OllamaEmbeddings(model="bge-m3", base_url="http://ollama:11434")
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
def generate_summary(request):
    """
    Generate a summary for a given text using LLM.
    """
    try:
        text = request.data.get('text')
        
        if not text:
            return Response(
                {"error": "Text parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        summary = DocumentProcessor.generate_summary(text)
        
        return Response(
            {"summary": summary},
            status=status.HTTP_200_OK
        )

    except ConnectionRefusedError:
        logger.error("Connection refused when trying to connect to Ollama API")
        return Response(
            {
                "error": "Failed to connect to Ollama API. Please ensure Ollama is running on localhost:11434",
                "details": "Connection refused"
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"Summary generation error: {str(e)}")
        return Response(
            {"error": f"Summary generation failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def chat_with_docs(request):
    """
    Chat with documents using vector search and an LLM.
    This endpoint:
    - Embeds the query
    - Finds similar document chunks
    - Ranks documents by chunk similarity
    - Uses a persona-driven prompt to get a helpful answer from an LLM
    - Streams the response back to the client
    """
    query = request.data.get('query')
    if not query:
        return Response(
            {"error": "Query parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Embed the query
        embedding_model = OllamaEmbeddings(model="bge-m3", base_url="http://ollama:11434")
        query_embedding = embedding_model.embed_query(query)
        if query_embedding is None:
            return Response(
                {"error": "Failed to create query embedding."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        chunks_with_distance = (
            DocumentChunk.objects.annotate(
                cosine_distance=CosineDistance(F('embedding_vector'), query_embedding)
            )
            .order_by('cosine_distance') 
        )

        if not chunks_with_distance.exists():
            return Response(
                {"error": "No relevant documents found for the query."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Retrieve top candidate chunks
        initial_top_k = 10
        candidate_chunks = list(chunks_with_distance[:initial_top_k])

        # Convert distance to similarity score = 1 - distance
        for c in candidate_chunks:
            c.cosine_similarity = 1.0 - c.cosine_distance

        # Group chunks by document
        doc_chunks = defaultdict(list)
        for chunk in candidate_chunks:
            doc_chunks[chunk.document_id].append(chunk)

        # Rank documents by top chunk similarity
        doc_scores = {}
        for doc_id, ch_list in doc_chunks.items():
            # Sort chunks by similarity
            ch_list.sort(key=lambda x: x.cosine_similarity, reverse=True)
            # Use the best chunk similarity as doc score (simple and effective)
            doc_scores[doc_id] = ch_list[0].cosine_similarity if ch_list else 0.0

        # Re-rank documents based on top chunk similarity
        ranked_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)

        if not ranked_docs:
            return Response(
                {"error": "No documents could be ranked."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Apply similarity difference threshold
        top_score = ranked_docs[0][1]
        similarity_threshold = 0.70 * top_score
        filtered_docs = [doc for doc in ranked_docs if doc[1] >= similarity_threshold]

        if not filtered_docs:
            return Response(
                {"error": "No documents passed the similarity threshold."},
                status=status.HTTP_404_NOT_FOUND
            )


        top_n_docs = 4
        top_doc_ids = [doc_id for doc_id, score in filtered_docs[:top_n_docs]]

        final_chunks = []

        for doc_id in top_doc_ids:
            sorted_chunks = sorted(doc_chunks[doc_id], key=lambda x: x.cosine_similarity, reverse=True)
            final_chunks.extend(sorted_chunks)

        unique_contents = set()
        deduped_chunks = []

        for chunk in final_chunks:
            if chunk.content not in unique_contents:
                unique_contents.add(chunk.content)
                deduped_chunks.append(chunk)

        context = "\n\n".join(
            f"From Document '{chunk.document.title}':\n{chunk.content}"
            for chunk in deduped_chunks
        )

        system_prompt = """
        You are Athena, an intelligent research assistant specializing in document analysis and question answering.
        Your task is to analyze the provided document excerpts and respond to user queries with precision and clarity.

        Guidelines:
        1. Document Citations
           - Always cite relevant documents by title when referencing specific information
           - Include document titles in your explanations naturally
        
        2. Response Style
           - Be clear, professional and approachable
           - Structure responses logically
           - Use bullet points or numbered lists for complex explanations
        
        3. Handling Information
           - For direct questions: Provide specific, targeted answers
           - For open-ended queries: Summarize key relevant points
           - Clearly state any assumptions made
           - If context is not relevant, acknowledge this explicitly
           - Avoid speculation beyond the provided content
        """

        user_prompt = f"""
        Question: {query}

        Available Document Context:
        {context}

        Please provide a comprehensive response following the system guidelines.
        """

        llm = ChatOllama(model="llama3.2", base_url="http://ollama:11434")
        messages = [
            ("system", system_prompt),
            ("human", user_prompt)
        ]

        def stream_response():
            response_text = ""
            for chunk in llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    response_text += chunk.content
                    yield chunk.content

        return StreamingHttpResponse(
            stream_response(),
            content_type='application/json'
        )

    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        return Response(
            {"error": f"Chat failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def retry_doc_processing(request, doc_id):
    """
    Retry processing a failed document from where it left off.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        if not document.is_failed:
            return Response(
                {"status": "error", "message": "Document is not in failed state"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create task chain based on current status
        tasks = []
        current_status = DocumentStatus(document.status)

        if current_status in [DocumentStatus.PENDING, DocumentStatus.TEXT_EXTRACTING]:
            tasks.append(save_chunks_task.s(document.id))
            tasks.append(generate_summary_task.s())
            tasks.append(embed_text_task.s())
        elif current_status in [DocumentStatus.TEXT_EXTRACTED, DocumentStatus.GENERATING_SUMMARY]:
            tasks.append(generate_summary_task.s(document.id))
            tasks.append(embed_text_task.s())
        elif current_status in [DocumentStatus.SUMMARY_GENERATED, DocumentStatus.EMBEDDING_TEXT]:
            tasks.append(embed_text_task.s(document.id))

        if not tasks:
            return Response(
                {"status": "error", "message": "No tasks to retry"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reset failed status
        document.is_failed = False
        
        # Create and execute task chain
        task_chain = chain(*tasks)
        result = task_chain.apply_async()
        
        # Update document with new task ID
        document.task_id = result.id
        document.save()

        return Response({
            "status": "success",
            "message": "Document processing restarted",
            "task_id": result.id
        }, status=status.HTTP_200_OK)

    except Document.DoesNotExist:
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error retrying document processing: {str(e)}")
        return Response(
            {"status": "error", "message": str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
