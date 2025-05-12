import logging
import os
from django.conf import settings

from celery import chain
from celery.result import AsyncResult
from django.http import FileResponse, StreamingHttpResponse, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from langchain_core.runnables.graph import MermaidDrawMethod

from ..models import Document, DocumentFullText, Chat
from ..serializers import DocumentSerializer, ChatSerializer
from ..tasks.tasks import (generate_document_summary_task,
                          extract_text_task,
                          chunk_and_embed_text_task,
                          update_document_status)
from ..utils.extractor import make_snippet
from ..utils.upload import UploadUtils
from ..utils.permissions import IsAuthenticated, IsSuperAdmin, IsOwnerOrAdmin, AllowAny
from ..services.vectorstore import vector_store
from ..services.catsight_agent import catsight_agent, _print_event
from ..models import DocumentStatus
import json
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables.graph_mermaid import MermaidDrawMethod
from langchain_core.documents import Document as LangchainDocument
from IPython.display import Image
from ..utils import pretty_print_messages

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_docs(request):
    """
    Retrieve a list of all documents sorted by creation date with pagination.
    """
    documents = Document.objects.all().order_by('-created_at')
    
    # Filter by status if specified
    status_filter = request.GET.get('status')
    if status_filter and status_filter != 'all':
        documents = documents.filter(status=status_filter)
    
    # Filter by year if specified
    years = request.GET.get('year')
    if years:
        year_list = years.split(',')
        documents = documents.filter(year__in=year_list)
    
    # Filter by tags if specified
    tags = request.GET.get('tags')
    if tags:
        tag_list = tags.split(',')
        # Filter documents that have any of the specified tags
        documents = documents.filter(tags__contains=tag_list)
    
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
        try:
            serializer = DocumentSerializer(data={'title': file.name})
            
            if serializer.is_valid():
                document = serializer.save(file=None, uploaded_by=request.user)

                try:
                    file_path, preview_path, blurhash_string = UploadUtils.upload_document(file, str(document.id))
                    logger.info(f"Document {document.id} upload results: file_path={file_path}, preview_path={preview_path}, blurhash={blurhash_string is not None}")
                    
                    document.file = file_path
                    document.preview_image = preview_path
                    document.blurhash = blurhash_string
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
                except Exception as e:
                    # If file upload process fails, clean up and log error
                    logger.error(f"Error in document upload process for {file.name}: {str(e)}", exc_info=True)
                    document.delete()  # Clean up the document record
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
        
        # Group results by document
        documents_map = {}
        
        for doc, score in docs_with_scores:
            doc_id = doc.metadata.get("doc_id")
            chunk_index = doc.metadata.get("index")
            
            if not doc_id:
                continue
                
            if doc_id not in documents_map:
                try:
                    document = Document.objects.get(id=doc_id)
                    documents_map[doc_id] = {
                        "document_id": doc_id,
                        "title": document.title,
                        "summary": document.summary,
                        "year": document.year,
                        "tags": document.tags,
                        "file_name": document.file_name,
                        "file_type": document.file_type,
                        "created_at": document.created_at.isoformat(),
                        "updated_at": document.updated_at.isoformat(),
                        "blurhash": document.blurhash,
                        "preview_image": document.preview_image,
                        "no_of_chunks": document.no_of_chunks,
                        "uploaded_by": {
                            "username": document.uploaded_by.username if document.uploaded_by else None,
                            "email": document.uploaded_by.email if document.uploaded_by else None,
                        },
                        "markdown_converter": document.markdown_converter,
                        "results": [],
                        "max_score": 0  # Track highest score for sorting
                    }
                except Document.DoesNotExist:
                    continue
            
            documents_map[doc_id]["results"].append({
                "chunk_index": chunk_index,
                "text": doc.page_content,
                "score": score,
                "snippet": make_snippet(doc.page_content, query)
            })
            
            # Update max score if this chunk has a higher score
            documents_map[doc_id]["max_score"] = max(documents_map[doc_id]["max_score"], score)
        
        # Convert to list and sort by max score
        grouped_results = list(documents_map.values())
        grouped_results.sort(key=lambda x: x["max_score"], reverse=True)
        
        # Paginate the grouped results
        paginator = Paginator(grouped_results, page_size)
        
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
    if isinstance(obj, (HumanMessage, AIMessage, ToolMessage)):
        message_type = "human"
        content = getattr(obj, "content", "")

        if isinstance(obj, AIMessage):
            message_type = "ai"
        elif isinstance(obj, ToolMessage):
            message_type = "tool"
            
        result = {
            "role": message_type,
            "content": content,
            "id": getattr(obj, "id", None),
            "additional_kwargs": getattr(obj, "additional_kwargs", {}),
        }
        
        # Add tool-specific fields for ToolMessage
        if isinstance(obj, ToolMessage):
            result.update({
                "name": getattr(obj, "name", ""),
                "tool_call_id": getattr(obj, "tool_call_id", "")
            })
            
        return result
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
    
    model_id = body.get("model_id", "llama3.2:1b")  # Default model if not specified
    chat_id = body.get("chat_id")  # Get chat_id if continuing an existing chat
        
    def event_stream():
        nonlocal chat_id
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
        input_state = {"current_query": query, "messages": input_messages}

        # Keep track of the latest sources from tool messages
        latest_sources = []
        has_sent_ai_message = False
        ai_message_id = None

        try:
            _printed = set()
            for state in catsight_agent.stream(
                input=input_state,
                config=config,
                stream_mode="values"
            ):               
                _print_event(state, _printed)
                # Check if title has been generated
                if "title" in state and state.get("should_generate_title") is False and state["title"]:
                    # Update chat title in the database
                    chat.title = state["title"]
                    chat.save()
                    
                    # Send title event to frontend
                    yield f"event: title\ndata: {{\"title\": \"{state['title']}\"}}\n\n"
                
                # First, extract any tool message with sources
                if "messages" in state:
                    for message in state["messages"]:
                        if isinstance(message, ToolMessage) and message.name == "retrieve_context":
                            try:
                                source_content = message.content
                                if isinstance(source_content, str):
                                    sources = json.loads(source_content)
                                    if isinstance(sources, list) and len(sources) > 0:
                                        latest_sources = sources
                                        # If we've already sent an AI message, send an update with the sources
                                        if has_sent_ai_message and ai_message_id:
                                            yield f"event: sources\ndata: {json.dumps({'message_id': ai_message_id, 'sources': latest_sources})}\n\n"
                            except Exception as e:
                                logger.error(f"Error processing tool message content: {str(e)}")
                
                # Process AI messages and attach sources
                if "messages" in state:
                    for message in state["messages"]:
                        if isinstance(message, AIMessage) and message.content and not message.tool_calls:
                            # This is a main AI response message
                            has_sent_ai_message = True
                            ai_message_id = getattr(message, "id", f"ai-{hash(message.content)}")
                
                # Make the state serializable
                serializable_state = _make_serializable(state)
                
                # Add sources to the delta if there's an AI message
                if has_sent_ai_message and latest_sources and "messages" in serializable_state:
                    for msg in serializable_state["messages"]:
                        if msg["role"] == "ai" and "content" in msg and msg["content"] and "tool_calls" not in msg:
                            msg["sources"] = latest_sources
                
                # Send update event
                yield f"event: update\ndata: {json.dumps({'delta': serializable_state})}\n\n"
        
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
            is_previous_tool_message = False
            sources = []
            
            for msg in messages:
                msg.pretty_print()
                role = "user" if isinstance(msg, HumanMessage) else "tool" if isinstance(msg, ToolMessage) else "assistant"

                content = getattr(msg, "content", "")
                
                if not content or content.startswith("Error: ") or (role == "tool" and msg.name == "grade_relevance"):
                    continue

                logger.info("========<DEBUG>=========")
                logger.info(msg)
                logger.info("========<END_DEBUG>=========")
                
                if isinstance(msg, ToolMessage):
                    is_previous_tool_message = True
                    sources = json.loads(content)
                    continue

                formatted_messages.append({
                    "id": getattr(msg, "id", f"{role}-{len(formatted_messages)}"),
                    "role": role,
                    "content": content,
                    "timestamp": getattr(msg, "additional_kwargs", {}).get("timestamp", ""),
                    "sources": sources if is_previous_tool_message else []
                })

                is_previous_tool_message = False

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
        # Get the Mermaid string
        mermaid_text = catsight_agent.get_graph().draw_mermaid()
        
        # Create a simple HTML page with the mermaid diagram
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>LangGraph Visualization</title>
            <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
            <script>
                mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
            </script>
            <style>
                body {{ margin: 0; padding: 0; }}
                .mermaid {{ max-width: 100%; }}
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
    """
    try:
        document = Document.objects.get(id=doc_id)
        
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

        # 1) Delete old vectors
        vector_store.delete(filter={"doc_id": doc_id})

        # 2) Delete existing full text if it exists
        DocumentFullText.objects.filter(document=document).delete()

        # 3) Update document's markdown converter and reset status
        document.markdown_converter = markdown_converter
        update_document_status(document, DocumentStatus.PENDING, update_fields=["status", "markdown_converter"])

        # 4) Kick off extraction tasks chain
        task_chain = chain(
            extract_text_task.s(document.id),
            chunk_and_embed_text_task.s(),
            generate_document_summary_task.s()
        )
        result = task_chain.apply_async()
        
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