import logging

from celery import chain
from celery.result import AsyncResult
from django.db.models import F
from django.http import FileResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

from ..models import Document, User
from ..serializers import DocumentSerializer
from ..tasks.tasks import (generate_document_summary_task,
                          process_document_chunks_task)
from ..utils.extractor import combine_chunks, make_snippet
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
    Retrieve a list of all documents sorted by creation date with pagination.
    """
    documents = Document.objects.all().order_by('-created_at')
    
    # Pagination
    page_size = int(request.GET.get('page_size', 9))
    page_number = int(request.GET.get('page', 1))
    
    paginator = Paginator(documents, page_size)
    
    try:
        page = paginator.page(page_number)
    except PageNotAnInteger:
        page = paginator.page(1)
    except EmptyPage:
        page = paginator.page(paginator.num_pages)
    
    serializer = DocumentSerializer(page.object_list, many=True)
    
    return Response({
        'results': serializer.data,
        'count': paginator.count,
        'num_pages': paginator.num_pages,
        'page': page.number,
        'next': page.next_page_number() if page.has_next() else None,
        'previous': page.previous_page_number() if page.has_previous() else None,
    }, status=status.HTTP_200_OK)

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
    query = request.GET.get("query", "").strip()
    if not query:
        return Response(
            {"error": "The 'query' parameter is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Pagination
    page_size = int(request.GET.get('page_size', 9))
    page_number = int(request.GET.get('page', 1))

    try:
        # Perform similarity search with scores
        docs_with_scores = vector_store.similarity_search_with_score(query, k=50)  # Get more results for pagination

        # Build result list including score, chunk index, and snippet
        results = []
        for doc, score in docs_with_scores:
            chunk_index = doc.metadata.get("chunk")
            results.append({
                "source": doc.metadata.get("source"),
                "chunk_index": chunk_index,
                "text": doc.page_content,
                "score": score,
                "snippet": make_snippet(doc.page_content, query)
            })

        # Paginate the results
        paginator = Paginator(results, page_size)
        
        
        try:
            page = paginator.page(page_number)
        except PageNotAnInteger:
            page = paginator.page(1)
        except EmptyPage:
            page = paginator.page(paginator.num_pages)
        
        return Response({
            'results': page.object_list,
            'count': paginator.count,
            'num_pages': paginator.num_pages,
            'page': page.number,
            'next': page.next_page_number() if page.has_next() else None,
            'previous': page.previous_page_number() if page.has_previous() else None,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception("Search failed")
        return Response(
            {"error": f"Search failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
    

