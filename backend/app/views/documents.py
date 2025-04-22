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

from ..models import Document, DocumentFullText
from ..serializers import DocumentSerializer
from ..tasks.tasks import (generate_document_summary_task,
                          extract_text_task,
                          chunk_and_embed_text_task,
                          update_document_status)
from ..utils.extractor import make_snippet
from ..utils.upload import UploadUtils
from ..utils.permissions import IsAuthenticated, IsSuperAdmin, IsOwnerOrAdmin, AllowAny
from ..services.vectorstore import vector_store

from ..services.chat_agent import graph
from ..models import DocumentStatus
import json
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables.graph_mermaid import MermaidDrawMethod
from langchain_core.documents import Document as LangchainDocument
from IPython.display import Image
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
            document.file_name = file.name
            document.file_type = file.content_type
            document.save()
            
            task_chain = chain(
                extract_text_task.s(document.id),
                chunk_and_embed_text_task.s(),
                generate_document_summary_task.s()
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
    Prioritizes using the saved DocumentFullText, falling back to
    reconstructing from chunks if necessary.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        chunks = vector_store.similarity_search(
            "", 
            k=document.no_of_chunks,
            filter={"doc_id": document.id}
        )
        
        chunks.sort(key=lambda x: x.metadata.get('index', 0))
        chunks = [chunk.page_content for chunk in chunks]
        
        logger.info(f"Chunks: {chunks}")
        
        markdown_text = DocumentFullText.objects.get(document=document).text
           
        return Response({"content": markdown_text, "chunks": chunks}, status=status.HTTP_200_OK)
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
@permission_classes([IsAuthenticated])
def update_doc_markdown(request, doc_id):
    new_md = request.data.get("markdown")
    if new_md is None:
        return Response(
            {"detail": "No markdown provided"}, status=400
        )

    # 1) Delete old vectors
    vector_store.delete(filter={"doc_id": doc_id})

    # 2) Update the full‐text
    fulltext, _ = DocumentFullText.objects.get_or_create(document_id=doc_id)
    fulltext.text = new_md
    fulltext.save()

    # 3) Reset document status to "extracted" so chunk task can proceed
    document = Document.objects.get(pk=doc_id)
    update_document_status(document, DocumentStatus.TEXT_EXTRACTED)

    # 4) Kick off re‐chunk & re‐summary
    task_chain = chain(
        chunk_and_embed_text_task.s(doc_id),
        generate_document_summary_task.s()
    )
    task_chain.apply_async()

    return Response(status=200)

    
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
def _serialize_document(doc: LangchainDocument) -> dict:
    """Convert a Document object to a serializable dict."""
    return {
        "page_content": doc.page_content,
        "metadata": doc.metadata,
    }

def _make_serializable(obj):
    """Recursively convert objects to JSON-serializable types."""
    if isinstance(obj, list):
        return [_make_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, LangchainDocument):
        return _serialize_document(obj)
    # fallback for any other Document‐like object
    if hasattr(obj, "page_content") and hasattr(obj, "metadata"):
        return {
            "page_content": getattr(obj, "page_content", ""),
            "metadata": getattr(obj, "metadata", {}),
        }
    return obj

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_with_docs(request):
    query = request.data.get("query")
    if not query:
        return Response({"error": "Query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

    inputs = {"messages": [HumanMessage(content=query)]}

    def event_stream():
        full_content = ""
        response_context = None

        print(f"Chat inputs: {inputs}")

        for chunk in graph.stream(inputs, stream_mode='values'):
            print(f"CHUNK: {chunk}")

            # pull out the user’s content from either
            #  • a top‐level AIMessage, or
            #  • an AIMessage nested inside chunk["messages"]
            part = ""
            if isinstance(chunk, AIMessage):
                part = chunk.content
            elif isinstance(chunk, dict):
                # check for an AIMessage embedded in chunk["messages"]
                for msg in chunk.get("messages", []):
                    if isinstance(msg, AIMessage):
                        part = msg.content
                        break

                # if there was no embedded AIMessage, fall back to any chunk["content"]
                if not part:
                    part = chunk.get("content", "") or ""

                # grab any context they sent
                if "context" in chunk:
                    response_context = chunk["context"]
            else:
                continue

            full_content += part

            payload = {"content": part}
            if response_context:
                try:
                    serialized = _make_serializable(response_context)
                    # cap at first 3 items
                    if isinstance(serialized, list) and len(serialized) > 3:
                        serialized = serialized[:3]
                    payload["context"] = serialized
                except Exception as e:
                    print(f"Error serializing context: {e}")

            try:
                yield f"data: {json.dumps(payload)}\n\n"
            except Exception as e:
                print(f"Error serializing payload: {e}")
                # fallback without context
                yield f"data: {json.dumps({'content': part})}\n\n"

        # final payload (in case context arrived only at the very end)
        if not response_context and hasattr(graph, 'last_response'):
            last = getattr(graph, 'last_response')
            if hasattr(last, 'context'):
                response_context = last.context

        final = {'content': full_content, 'finished': True}
        if response_context:
            try:
                serialized = _make_serializable(response_context)
                if isinstance(serialized, list) and len(serialized) > 3:
                    serialized = serialized[:3]
                final['context'] = serialized
            except Exception as e:
                print(f"Error serializing final context: {e}")

        try:
            yield f"data: {json.dumps(final)}\n\n"
        except Exception as e:
            print(f"Error serializing final payload: {e}")
            yield f"data: {json.dumps({'content': full_content, 'finished': True})}\n\n"

    return StreamingHttpResponse(event_stream(), content_type="text/event-stream")

# GET /api/documents/graph
@api_view(['GET'])
@permission_classes([AllowAny])
def get_graph(request):
    try:
        # Get the Mermaid string directly instead of rendering to PNG
        mermaid_text = graph.get_graph().draw_mermaid()
        
        # Return the Mermaid text in a JSON response
        return Response({
            "mermaid": mermaid_text,
            "format": "mermaid",
            "message": "Render this mermaid diagram on the client side for better compatibility"
        })
    except Exception as e:
        logger.error(f"Error getting graph: {str(e)}")
        return Response(
            {"error": f"Failed to get graph: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )