import logging

from celery import chain
from celery.result import AsyncResult
from django.db.models import F
from django.http import FileResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from ..models import Document, User
from ..serializers import DocumentSerializer
from ..tasks.tasks import (generate_document_summary_task,
                          process_document_chunks_task)
from ..utils.extractor import combine_chunks
from ..utils.upload import UploadUtils
from ..utils.permissions import IsAuthenticated, IsAdmin, IsSuperAdmin, IsOwnerOrAdmin
from ..services.vectorstore import vector_store

from langgraph.graph import START, StateGraph, END
from ..services.chat_agent import ChatState, retrieve, generate, grade_answer, format_output, ChatStates


logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_docs(request):
    """
    Retrieve a list of all documents sorted by creation date.
    """
    documents = Document.objects.all().order_by('-created_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload_doc(request):
    """
    Handle multiple document uploads and initiate OCR and summary generation using Celery tasks.
    Only admins can upload documents.
    """
    uploaded_files = request.FILES.getlist('files')
    markdown_converter = request.data.get('markdown_converter')

    if not uploaded_files:
        return Response({"status": "error", "message": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

    response_data = []

    for file in uploaded_files:
        
        serializer = DocumentSerializer(data={'title': file.name})
        
        if serializer.is_valid():
            document = serializer.save(file=None, uploaded_by=request.user)

            document.file = UploadUtils.upload_document(file, str(document.id))
            document.markdown_converter = markdown_converter
            document.save()
            
            task_chain = chain(
                process_document_chunks_task.s(document.id),
                generate_document_summary_task.s(),
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
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
def get_doc_raw(request, doc_id):
    """
    Retrieve the raw content of a document by its ID.
    """
    document = Document.objects.get(id=doc_id)
    file_path = UploadUtils.get_document_file(doc_id, 'original')
    return FileResponse(open(file_path, 'rb'))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_doc_markdown(request, doc_id):
    """
    Retrieve the markdown content of a document by its ID.
    Handles overlapping chunks by removing duplicate content.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        # Get chunks from vector store instead of DocumentChunk model
        chunks = vector_store.similarity_search(
            "", 
            k=document.no_of_chunks,
            filter={"doc_id": document.id}
        )
        
        # Sort chunks by index
        chunks.sort(key=lambda x: x.metadata.get('index', 0))
        
        # Extract page content
        contents = [chunk.page_content for chunk in chunks]
        
        combined_text = combine_chunks(contents)
       
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
@permission_classes([IsOwnerOrAdmin])
def delete_doc(request, doc_id):
    """
    Delete a document by its ID, cancel any running tasks, and remove associated files.
    Only admins can delete documents.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        # Revoke any running tasks
        revoke_task(document.task_id)
        
        # Delete associated chunks from vector store
        try:
            vector_store.delete(filter={"doc_id": doc_id})
        except Exception as e:
            logger.error(f"Error deleting vector store chunks: {str(e)}")
        
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
@permission_classes([IsAuthenticated])
def get_doc_chunks(request, doc_id):
    """
    Retrieve the chunks for a document by its ID.
    """
    try:
        document = Document.objects.get(id=doc_id)
    except Document.DoesNotExist:
        return Response({"status": "error", "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
    
    # Get chunks from vector store
    chunks = vector_store.similarity_search(
        "", 
        k=document.no_of_chunks, 
        filter={"doc_id": document.id}
    )
    
    # Format chunks for response
    chunk_data = []
    for chunk in chunks:
        chunk_data.append({
            "id": chunk.metadata.get("id"),
            "index": chunk.metadata.get("index"),
            "content": chunk.page_content,
            "document_id": document.id
        })
    
    return Response(chunk_data)
    

@api_view(['DELETE'])
@permission_classes([IsSuperAdmin])
def delete_all_docs(request):
    """
    Delete all documents, cancel running tasks, and remove associated files.
    Only super admins can delete all documents.
    """
    try:
        # Revoke all running tasks for all documents
        documents = Document.objects.all()

        for doc in documents:
            revoke_task(doc.task_id)
        
        try:
            vector_store.delete(filter={})
        except Exception as e:
            logger.error(f"Error deleting vector store data: {str(e)}")
        
        # Delete all documents
        Document.objects.all().delete()
        
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
@permission_classes([IsAdmin])
def update_doc(request, doc_id):
    """
    Update document metadata (title, description).
    Only admins can update documents.
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
@permission_classes([IsAuthenticated])
def search_docs(request):
    """
    Search documents using vector similarity and optional keyword filtering.
    Merges chunks from the same document and includes them in the response.

    Expected query parameters:
    - query: search text (required)
    - title: optional title substring filter
    - limit: max number of results (default 10)
    """
    query = request.GET.get('query')
    title_filter = request.GET.get('title')
    limit = request.GET.get('limit', 10)

    # Validate required parameters
    if not query:
        return Response({"error": "'query' parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Validate limit parameter
    try:
        limit = int(limit)
        if limit <= 0:
            limit = 10
    except (ValueError, TypeError):
        limit = 10

    try:
        # Use the filter parameter if title is provided
        filter_params = {}
        if title_filter:
            # NOTE: Vector stores may handle filtering differently
            # This implementation assumes that document titles are indexed in the vector store metadata
            # You may need to adjust this based on your specific vector store API
            documents = Document.objects.filter(title__icontains=title_filter)
            if documents:
                doc_ids = [str(doc.id) for doc in documents]
                filter_params = {"doc_id": {"$in": doc_ids}}
        
        # Similarity search using vector store
        results = vector_store.similarity_search(
            query, 
            k=limit,
            filter=filter_params
        )
        
        # Group results by document
        document_chunks = {}
        for chunk in results:
            doc_id = chunk.metadata.get("doc_id")
            if not doc_id:
                continue
            
            # Try to get document info from database
            try:
                doc = Document.objects.get(id=doc_id)
                if doc_id not in document_chunks:
                    document_chunks[doc_id] = {
                        'document_id': doc_id,
                        'document_title': doc.title,
                        'created_at': doc.created_at,
                        'chunks': []
                    }
                document_chunks[doc_id]['chunks'].append({
                    'chunk_index': chunk.metadata.get("index"),
                    'content': chunk.page_content,
                })
            except Document.DoesNotExist:
                # Skip if document doesn't exist anymore
                continue

        response_data = list(document_chunks.values())
        return Response(response_data, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error("Search error: %s", str(e), exc_info=True)
        return Response({"error": f"Search failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_with_docs(request):
    query = request.data.get("query")
    if not query:
        return Response(
            {"error": "Query parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        graph = (
            StateGraph(ChatState)
            .add_node(ChatStates.RETRIEVE.value, retrieve)
            .add_node(ChatStates.GENERATE.value, generate)
            .add_node(ChatStates.GRADE.value, grade_answer)
            .add_node(ChatStates.FORMAT.value, format_output)

            .add_edge(START, ChatStates.RETRIEVE.value)
            .add_edge(ChatStates.RETRIEVE.value, ChatStates.GENERATE.value)
            .add_edge(ChatStates.GENERATE.value, ChatStates.GRADE.value)
            .add_edge(ChatStates.GRADE.value, ChatStates.FORMAT.value)
            .add_edge(ChatStates.FORMAT.value, END)

            .compile()
        )

        result = graph.invoke({"question": query})
        return Response(result, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error("Error in chat_with_docs", exc_info=True)
        return Response(
            {"error": f"Failed to generate response: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )