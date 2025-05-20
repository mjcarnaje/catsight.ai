import logging
import os
from django.conf import settings

from celery.result import AsyncResult
from django.http import FileResponse, StreamingHttpResponse, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Count, Avg
from django.db.models.functions import TruncMonth
from django.db import models
from django.utils import timezone
from datetime import timedelta

from ..models import Document, DocumentFullText, Chat, Tag, User
from ..serializers import DocumentSerializer
from ..tasks.tasks import (generate_document_summary_task,
                          update_document_status,
                          process_document_task)
from ..utils.upload import UploadUtils
from ..utils.permissions import IsAuthenticated, IsSuperAdmin, IsOwnerOrAdmin, AllowAny
from ..services.vectorstore import vector_store
from ..services.catsight_agent import catsight_agent
from ..models import DocumentStatus
import json
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from ..services.rag_agent import rag_agent
from ..services.summarization_agent import summarization_agent
from ..utils.langgraph import _print_event

logger = logging.getLogger(__name__)

def revoke_task(task_id):
    """Helper function to revoke a Celery task"""
    if task_id:
        try:
            AsyncResult(task_id).revoke(terminate=True)
            logger.info(f"Task {task_id} revoked successfully")
        except Exception as e:
            logger.error(f"Error revoking task {task_id}: {str(e)}")

def _delete_chunks(doc_id):
    """Helper function to delete chunks for a document"""
    try:
        retriever = vector_store.as_retriever(
            search_kwargs={"k": 100, "filter": {"doc_id": doc_id}},
        )
        chunks = retriever.get_relevant_documents("")
        ids = [chunk.id for chunk in chunks]
        vector_store.delete(ids=ids)
    except Exception as e:
        logger.error(f"Error deleting vector store chunks: {str(e)}")

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_docs(request):
    """
    Retrieve a list of all documents sorted by creation date with pagination.
    """
    documents = Document.objects.all().order_by('-created_at')
    
    status_filter = request.GET.get('status')
    
    if status_filter and status_filter != 'all':
        documents = documents.filter(status=status_filter)
    
    years = request.GET.get('year')
    if years:
        year_list = years.split(',')
        documents = documents.filter(year__in=year_list)
    
    tags = request.GET.get('tags')
    if tags:
        tag_list = tags.split(',')
        documents = documents.filter(tags__id__in=tag_list)
    
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
    """
    uploaded_files = request.FILES.getlist('files')
    markdown_converter = request.data.get('markdown_converter') or request.user.default_markdown_converter
    summarization_model = request.data.get('summarization_model') or request.user.default_summarization_model

    if not uploaded_files:
        return Response({"status": "error", "message": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

    response_data = []

    for file in uploaded_files:
        try:
            serializer = DocumentSerializer(data={'title': file.name})
            
            if serializer.is_valid():
                document = serializer.save(file=None, uploaded_by=request.user)

                try:
                    file_path, preview_path, blurhash_string, page_count = UploadUtils.upload_document(file, str(document.id))
                    logger.info(f"Document {document.id} upload results: file_path={file_path}, preview_path={preview_path}, blurhash={blurhash_string is not None}, page_count={page_count}")
                    
                    document.file = file_path
                    document.preview_image = preview_path
                    document.blurhash = blurhash_string
                    document.markdown_converter = markdown_converter
                    document.page_count = page_count
                    if summarization_model:
                        document.summarization_model = summarization_model
                    document.file_name = file.name
                    document.file_type = file.content_type
                    document.save()
                    
                    result = process_document_task.delay(document.id)
                    document.task_id = result.id
                    document.save()

                    response_data.append({"status": "success", "id": document.id, "filename": file.name})
                except Exception as e:
                    logger.error(f"Error in document upload process for {file.name}: {str(e)}", exc_info=True)
                    document.delete() 
                    response_data.append({"status": "error", "filename": file.name, "errors": str(e)})
            else:
                logger.error(f"Document upload failed for {file.name}: {serializer.errors}")
                response_data.append({"status": "error", "filename": file.name, "errors": serializer.errors})
        except Exception as e:
            logger.error(f"Unexpected error during upload of {file.name}: {str(e)}", exc_info=True)
            response_data.append({"status": "error", "filename": file.name, "errors": str(e)})

    if all(item["status"] == "success" for item in response_data):
        return Response(response_data, status=status.HTTP_201_CREATED)
    elif all(item["status"] == "error" for item in response_data):
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_if_has_similar_filename(request):
    file_names = request.GET.get('file_names')
    """
    Check if a document has a similar filename to another document and return the similar filenames.
    """
    file_names = file_names.split(',')
    similar_files = []
    
    for file_name in file_names:
        similar_documents = Document.objects.filter(file_name__icontains=file_name)
        if similar_documents.exists():
            similar_files.extend([doc.file_name for doc in similar_documents])
    
    return Response({
        "has_similar_filename": len(similar_files) > 0,
        "similar_files": list(set(similar_files)) 
    }, status=status.HTTP_200_OK)

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
        
        try:
            logger.info(f"Deleting vector store chunks for document: {doc_id}")
            ids = [f"doc_{doc_id}_chunk_{i}" for i in range(document.no_of_chunks)]
            vector_store.delete(ids=ids)
        except Exception as e:
            logger.error(f"Error deleting vector store chunks: {str(e)}")
        
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
    

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_chunks(request, doc_id):
    """
    Delete the chunks for a document by its ID.
    """
    try:
        # Try to get document but don't require it to exist
        try:
            document = Document.objects.get(id=doc_id)
        except Document.DoesNotExist:
            logger.warning(f"Document not found: {doc_id}")
        
        _delete_chunks(doc_id)
        return Response({"status": "success", "message": "Chunks deleted successfully"}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error deleting chunks: {str(e)}")
        return Response({"status": "error", "message": f"Error deleting chunks: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    update_document_status(document, DocumentStatus.TEXT_EXTRACTION_DONE)

    # 4) Kick off re‐chunk & re‐summary using the process_document_task
    # This will detect the document's current status and continue from there
    result = process_document_task.delay(doc_id)
    document.task_id = result.id
    document.save(update_fields=["task_id"])

    return Response(status=200)

    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_docs(request):
    query = request.GET.get("query", "").strip()
    years = request.GET.get("year", "").strip()
    tags = request.GET.get("tags", "").strip()
    
    is_accurate = request.GET.get("accurate", "false") == "true"
    
    if not query:
        return Response(
            {"error": "The 'query' parameter is required."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    logger.info(f"Search query: {query}, years: {years}, tags: {tags}")

    try:
        import time
        start_time = time.time()
        
        result = rag_agent.invoke({"query": query, "is_accurate": is_accurate, "years": years, "tags": tags})
        
        query_time = time.time() - start_time
        
        return Response({
            'summary': result.get("summary", ""),
            'sources': result.get("sources", []),
            'query_time': query_time
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception("Search failed")
        return Response(
            {"error": f"Search failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def standard_search_docs(request):
    """
    Search documents by title and summary with optional year and tags filters.
    """
    query = request.GET.get("query", "").strip().lower()
    years = request.GET.get("year")
    tags = request.GET.get("tags")
    
    if not query:
        return Response(
            {"error": "The 'query' parameter is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        import time
        start_time = time.time()
        
        # Base query with title and summary search
        documents = Document.objects.filter(
            models.Q(title__icontains=query) |
            models.Q(summary__icontains=query)
        )

        # Apply year filter if provided
        if years:
            year_list = years.split(',')
            documents = documents.filter(year__in=year_list)
        
        # Apply tags filter if provided
        if tags:
            tag_list = tags.split(',')
            documents = documents.filter(tags__id__in=tag_list)

        # Order by creation date
        documents = documents.order_by('-created_at')

        # Format response similar to RAG search for frontend compatibility
        sources = []
        for doc in documents:
            source = {
                "id": doc.id,
                "title": doc.title,
                "summary": doc.summary,
                "year": doc.year,
                "tags": list(doc.tags.values('name', 'description')),
                "file_name": doc.file_name,
                "blurhash": doc.blurhash,
                "preview_image": doc.preview_image,
                "file_type": doc.file_type,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat(),
                "contents": []  # Empty contents since this is not a RAG search
            }
            sources.append(source)
            
        query_time = time.time() - start_time

        return Response({
            'summary': "",  # No AI summary for standard search
            'sources': sources,
            'query_time': query_time
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception("Standard search failed")
        return Response(
            {"error": f"Search failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_with_docs(request):
    """
    Chat with documents endpoint that uses LangGraph with PostgreSQL persistence.
    Streams AI responses using Server-Sent Events (SSE) protocol.
    """
    body = request.data
    if not body:
        return Response({"error": "No body provided"}, status=400)
    
    query = body.get("query")
    if not query or not isinstance(query, str) or not query.strip():
        return Response({"error": "Valid query parameter is required"}, status=400)
    
    model_id = body.get("model_id", "llama3.1:8b")
    chat_id = body.get("chat_id")
    file_ids = body.get("file_ids", [])
        
    def event_stream():
        nonlocal chat_id, query
        # Initialize or retrieve chat record
        if not chat_id:
            chat = Chat.objects.create(user=request.user, title="Untitled")
            chat_id = str(chat.id)
        else:
            chat = Chat.objects.filter(id=chat_id, user=request.user).first()
            if not chat:
                yield f"event: error\ndata: {{\"error\": \"Chat not found: {chat_id}\"}}\n\n"
                return

        yield f"event: start\ndata: {{\"chat_id\": \"{chat_id}\"}}\n\n"

        thread_id = f"thread_{chat_id}"
        config = {"configurable": {"model": model_id, "thread_id": thread_id}}

        # Build initial input messages list
        human_msg = HumanMessage(content=query)
        input_messages = [human_msg]
        input_state = {"current_query": query, "messages": input_messages, "file_ids": file_ids}

        try:
            _printed = set()
            streamed = set()
            
            for state in catsight_agent.stream(
                input=input_state,
                config=config,
                stream_mode="values"
            ):
                _print_event(state, _printed)
                
                if "title" in state and state.get("should_generate_title") is False and state["title"]:
                    chat.title = state["title"]
                    chat.save()
                    
                    yield f"event: title\ndata: {{\"title\": \"{state['title']}\"}}\n\n"

                
                messages = state.get("messages")
                
                if messages:
                    if isinstance(messages, list):
                        new_message = messages[-1]
                    
                    if new_message.id not in streamed:
                        role = "unknown"
                        if isinstance(new_message, HumanMessage):
                            role = "user"
                        elif isinstance(new_message, AIMessage):
                            role = "assistant"
                        elif isinstance(new_message, ToolMessage):
                            role = "tool"
                        
                        tool_calls = getattr(new_message, "tool_calls", [])
                        is_tool_calls = len(tool_calls) > 0
                        
                        message = {
                            "id": getattr(new_message, "id"),
                            "role": role,
                            "content": getattr(new_message, "content", ""),
                            "timestamp": getattr(new_message, "additional_kwargs", {}).get("timestamp", ""),
                            "message_type": "message",
                            "tool_call": None,
                            "tool_result": None
                        }

                        if role == "assistant" and is_tool_calls:
                            message["message_type"] = "tool_call"
                            
                            tool_name = tool_calls[0].get("name", "")
                            args = tool_calls[0].get("args", {})
                            query = args.get("query", "")

                            message["tool_call"] = {
                                "name": tool_name,
                                "query": query,
                            }
                            yield f"event: message\ndata: {json.dumps(message)}\n\n"
                            continue

                        if role == "tool":
                            if message["content"].startswith("{") or message["content"].startswith("["):
                                sources = json.loads(message["content"])
                                message["content"] = ""
                                message["tool_result"] = {
                                    "sources": sources,
                                }
                                yield f"event: message\ndata: {json.dumps(message)}\n\n"
                                continue

                        yield f"event: message\ndata: {json.dumps(message)}\n\n"
                        
                        streamed.add(new_message.id)
                    
                   
                
        except Exception as e:
            logger.error(f"Error streaming response: {str(e)}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        
        # End of stream
        yield "event: done\ndata: {}\n\n"
    
    # Return streaming response
    return StreamingHttpResponse(
        event_stream(),
        content_type="text/event-stream"
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_history(request, chat_id):
    """
    Retrieve chat history for a specific chat_id using LangGraph's state.
    """
    try:
        # Configure thread_id based on chat_id
        thread_id = f"thread_{chat_id}"
        config = {"configurable": {"thread_id": thread_id}}
        
        # Get the state from LangGraph
        try:
            saved_state = catsight_agent.get_state(config)
            messages = saved_state.values["messages"]
            
            # Get the model ID from the config if available
            model_id = config.get("configurable", {}).get("model", "llama3.2:1b")
                        
            # Filter out tool messages and format for frontend
            formatted_messages = []
            sources = []
            
            for msg in messages:
                msg.pretty_print()
                role = "unknown"

                if isinstance(msg, HumanMessage):
                    role = "user"
                elif isinstance(msg, AIMessage):
                    role = "assistant"
                elif isinstance(msg, ToolMessage):
                    role = "tool"

                tool_calls = getattr(msg, "tool_calls", [])
                is_tool_calls = len(tool_calls) > 0

                message = {
                    "id": getattr(msg, "id", f"{role}-{len(formatted_messages)}"),
                    "role": role,
                    "content": getattr(msg, "content", ""),
                    "timestamp": getattr(msg, "additional_kwargs", {}).get("timestamp", ""),
                    "message_type": "message",
                    "tool_call": None,
                    "tool_result": None
                }

                if role == "assistant" and is_tool_calls:
                    message["message_type"] = "tool_call"
                    
                    tool_name = tool_calls[0].get("name", "")
                    args = tool_calls[0].get("args", {})
                    query = args.get("query", "")

                    message["tool_call"] = {
                        "name": tool_name,
                        "query": query,
                    }
                    formatted_messages.append(message)
                    continue
                
                if role == "tool":
                    if message["content"].startswith("{") or message["content"].startswith("["):
                        sources = json.loads(message["content"])
                        message["content"] = ""
                        message["tool_result"] = {
                            "sources": sources,
                        }
                        formatted_messages.append(message)
                        continue

                formatted_messages.append(message)

            return Response({
                "messages": formatted_messages,
                "model_id": model_id,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving chat history: {str(e)}")
            return Response(
                {"error": f"Failed to retrieve chat history: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        logger.error(f"Error in get_chat_history: {str(e)}")
        return Response(
            {"error": f"Error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_graph_image(request):
    try:
        agent = request.GET.get("agent")

        if agent == "summary":
            mermaid_text = summarization_agent.get_graph().draw_mermaid()
        elif agent == "rag":
            mermaid_text = rag_agent.get_graph().draw_mermaid()
        else:
            mermaid_text = catsight_agent.get_graph().draw_mermaid()
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LangGraph Visualization</title>
            <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
            <script>
                document.addEventListener('DOMContentLoaded', function() {{
                    mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
                }});
            </script>
            <style>
                body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }}
                .mermaid {{ max-width: 100%; height: auto; }}
            </style>
        </head>
        <body>
            <div class="mermaid">
                {mermaid_text}
            </div>
        </body>
        </html>
        """
        
        # Return the HTML content
        return HttpResponse(
            html_content,
            content_type="text/html"
        )
    except Exception as e:
        logger.error(f"Error getting graph image: {str(e)}")
        return Response(
            {"error": f"Failed to get graph image: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_preview(request, doc_id):
    """
    Regenerate the preview image and blurhash for a document.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        # Get the original file path
        file_path = os.path.join(settings.MEDIA_ROOT, document.file)
        
        if not os.path.exists(file_path):
            return Response(
                {"status": "error", "message": "Original document file not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Generate preview image and blurhash
        preview_path, blurhash_string = UploadUtils.generate_preview_and_blurhash(
            doc_id, file_path
        )
        
        if not preview_path:
            return Response(
                {"status": "error", "message": "Failed to generate preview image"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Update document with new preview and blurhash
        document.preview_image = preview_path
        document.blurhash = blurhash_string
        document.save()
        
        return Response({
            "status": "success", 
            "message": "Preview regenerated successfully",
            "preview_image": preview_path,
            "blurhash": blurhash_string
        }, status=status.HTTP_200_OK)
        
    except Document.DoesNotExist:
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error regenerating preview for document {doc_id}: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Error regenerating preview: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_docs_count(request):
    """
    Return the total count of documents in the system.
    """
    try:
        count = Document.objects.count()
        return Response({"count": count}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting document count: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error getting document count: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_summary(request, doc_id):
    """
    Regenerate the summary, title, tags, and year for a document.
    Optionally update the summarization model to use.
    """
    try:
        document = Document.objects.get(id=doc_id)
        
        # Check if a new summarization model is provided
        summarization_model = request.data.get('summarization_model')
        if summarization_model:
            document.summarization_model = summarization_model
            document.save(update_fields=["summarization_model"])
            logger.info(f"Updated summarization model to {summarization_model} for document {doc_id}")
        
        # Kick off the summary generation task
        task = generate_document_summary_task.delay(doc_id)
        
        # Update task_id in document
        document.task_id = task.id
        document.save(update_fields=["task_id"])
        
        logger.info(f"Summary regeneration task started for document {doc_id}")
        return Response(
            {"status": "success", "message": "Document summary regeneration started"}, 
            status=status.HTTP_200_OK
        )
    except Document.DoesNotExist:
        logger.warning(f"Document not found: {doc_id}")
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error regenerating summary for document {doc_id}: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Error regenerating summary: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reextract_doc(request, doc_id):
    """
    Re-extract the document text using a different markdown converter.
    Deletes existing chunks and full text, then starts the extraction process again.
    Optionally update the summarization model to use.
    """
    try:
        # Get the document
        document = Document.objects.get(id=doc_id)

        # Get the new markdown converter from request
        markdown_converter = request.data.get("markdown_converter")
        if not markdown_converter:
            return Response(
                {"detail": "No markdown converter provided"}, status=400
            )

        # Check if a new summarization model is provided
        summarization_model = request.data.get('summarization_model')
        if summarization_model:
            document.summarization_model = summarization_model
            logger.info(f"Updated summarization model to {summarization_model} for document {doc_id}")

        # 1) Delete old vectors
        vector_store.delete(filter={"doc_id": doc_id})

        # 2) Delete existing full text if it exists
        DocumentFullText.objects.filter(document=document).delete()

        # 3) Update document's markdown converter and reset status
        document.markdown_converter = markdown_converter
        update_fields = ["status", "markdown_converter"]
        if summarization_model:
            update_fields.append("summarization_model")
        update_document_status(document, DocumentStatus.PENDING, update_fields=update_fields)

        # 4) Kick off the process using the new task
        result = process_document_task.delay(document.id)
        
        # Update task ID in document
        document.task_id = result.id
        document.save(update_fields=["task_id"])

        return Response(
            {"status": "success", "message": "Document re-extraction started"}, 
            status=status.HTTP_200_OK
        )
    except Document.DoesNotExist:
        logger.warning(f"Document not found: {doc_id}")
        return Response(
            {"status": "error", "message": "Document not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error re-extracting document {doc_id}: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Error re-extracting document: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tags(request):
    """
    Get all unique tags from the Tag model.
    """
    try:
        tags = Tag.objects.all().order_by('name')
        tag_data = [{'id': tag.id, 'name': tag.name} for tag in tags]
        return Response(tag_data, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting all tags: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error getting all tags: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_years(request):
    """
    Get all unique years from all documents.
    """
    try:
        # Get distinct years, exclude None values, and sort in descending order
        years = Document.objects.exclude(year__isnull=True).values_list('year', flat=True).distinct().order_by('-year')
        return Response(list(years), status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting all years: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error getting all years: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_statistics(request):
    """
    Return various statistics about the system.
    """
    try:
        # Initialize all possible statuses with count 0
        status_counts = {status.value: 0 for status in DocumentStatus}
        
        # Get document count by status using proper aggregation
        status_counts_by_status = {}
        for status_value in status_counts.keys():
            count = Document.objects.filter(status=status_value).count()
            status_counts[status_value] = count
            status_counts_by_status[status_value] = count
        
        logger.info(f"Status counts: {status_counts_by_status}")
        
        # Calculate average page count and chunks
        avg_page_count = Document.objects.aggregate(avg_pages=Avg('page_count'))['avg_pages'] or 0
        avg_chunks = Document.objects.aggregate(avg_chunks=Avg('no_of_chunks'))['avg_chunks'] or 0
        
        # Get document years distribution
        years_distribution = Document.objects.exclude(year__isnull=True).values('year').annotate(
            count=Count('id')
        ).order_by('year')
        
        # Get documents created per month (last 6 months)
        six_months_ago = timezone.now() - timedelta(days=180)
        docs_per_month = Document.objects.filter(
            created_at__gte=six_months_ago
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')
        
        documents_timeline = [{
            "month": item['month'].strftime('%b %Y'),
            "count": item['count']
        } for item in docs_per_month]
        
        stats = {
            "documents_count": Document.objects.count(),
            "chats_count": Chat.objects.count(),
            "users_count": User.objects.count(),
            "documents_by_status": status_counts,
            "avg_page_count": round(avg_page_count, 1),
            "avg_chunks": round(avg_chunks, 1),
            "years_distribution": [{
                "year": item['year'],
                "count": item['count']
            } for item in years_distribution],
            "documents_timeline": documents_timeline
        }
        
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting statistics: {str(e)}")
        return Response(
            {"status": "error", "message": f"Error getting statistics: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_docs_by_ids(request):
    """
    Retrieve documents by a list of IDs.
    Used to check progress of documents uploaded in chat.
    """
    doc_ids = request.data.get('doc_ids', [])
    
    if not doc_ids or not isinstance(doc_ids, list):
        return Response(
            {"error": "A list of document IDs is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        documents = Document.objects.filter(id__in=doc_ids).order_by('-created_at')
        serializer = DocumentSerializer(documents, many=True)
        
        return Response({
            'documents': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error retrieving documents by IDs: {str(e)}")
        return Response(
            {"error": f"Failed to retrieve documents: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
