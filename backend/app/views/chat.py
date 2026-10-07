"""Chat API. Answers stream as Server-Sent Events:

    start    {chat, question}            chat id/title and the saved question (with its id)
    search   {query}                     the agent is searching the documents
    sources  {sources}                   numbered sources found so far in this answer
    token    {id, text}                  a piece of the answer as it's written
    answer   {message}                   the finished answer, with its searches and sources
    title    {title}                     a new chat got its title
    error    {detail, code}              something went wrong (the stream then ends)
    done     {}

The client cancels by closing the connection; the generator is closed on the
next write, which stops the agent.
"""
import json
import logging
import uuid

from django.db.models import Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from ..constant import UsageKind
from ..models import Chat, Document
from ..serializers import ChatSerializer
from ..services import quotas
from ..services.agent import get_agent, merge_sources
from ..services.chats import config_for, delete_chat, saved_messages, serialize_answer, serialize_conversation, truncate_from
from ..services.errors import describe_error
from ..utils.permissions import IsAuthenticated

logger = logging.getLogger(__name__)

MAX_QUESTION_CHARS = 2000


def sse(event: str, data) -> str:
    """One Server-Sent Event; data is JSON so quotes and newlines can't break framing."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


class ChatPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def chats(request):
    queryset = Chat.objects.filter(user=request.user)
    if q := request.query_params.get("q", "").strip():
        queryset = queryset.filter(Q(title__icontains=q))
    paginator = ChatPagination()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(ChatSerializer(page, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def chat_detail(request, chat_id: int):
    chat = get_object_or_404(Chat, pk=chat_id, user=request.user)
    if request.method == "DELETE":
        delete_chat(chat)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        serializer = ChatSerializer(chat, data={"title": str(request.data.get("title", "")).strip()[:255]}, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(ChatSerializer(chat).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def chat_messages(request, chat_id: int):
    chat = get_object_or_404(Chat, pk=chat_id, user=request.user)
    messages = saved_messages(chat)
    state = get_agent().get_state(config_for(chat))
    document_ids = (state.values or {}).get("document_ids") or []
    scope = list(
        Document.objects.visible_to(request.user).filter(id__in=document_ids).values("id", "title", "file_name")
    )
    return Response({
        "chat": ChatSerializer(chat).data,
        "messages": serialize_conversation(messages),
        "scope": scope,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_stream(request):
    """Ask a question in a new or existing chat and stream the answer.

    Body: {question, chat_id?, document_ids?, replace_from?}
    `replace_from` (a question's id) deletes that question and everything after
    it first: regenerate sends the same question, edit sends a new one.
    """
    user = request.user
    question = str(request.data.get("question") or "").strip()
    chat_id = request.data.get("chat_id")
    replace_from = request.data.get("replace_from")
    document_ids = [int(i) for i in request.data.get("document_ids") or [] if str(i).isdigit()]

    if len(question) > MAX_QUESTION_CHARS:
        return Response({"detail": f"Questions can be up to {MAX_QUESTION_CHARS} characters."}, status=400)
    try:
        quotas.check_message(user)
    except quotas.QuotaExceeded as e:
        return Response({"detail": e.message, "code": e.code}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    chat = get_object_or_404(Chat, pk=chat_id, user=user) if chat_id else None
    if chat and replace_from:
        original = truncate_from(chat, str(replace_from))
        if original is None:
            return Response({"detail": "That message no longer exists."}, status=status.HTTP_409_CONFLICT)
        question = question or original
    if not question:
        return Response({"detail": "Ask a question."}, status=status.HTTP_400_BAD_REQUEST)
    if chat is None:
        chat = Chat.objects.create(user=user)

    # Only documents the user may read can scope the conversation
    document_ids = list(Document.objects.visible_to(user).filter(id__in=document_ids).values_list("id", flat=True))
    quotas.record(user, UsageKind.MESSAGE)

    human = HumanMessage(content=question, id=str(uuid.uuid4()))
    config = config_for(chat, user_id=user.id)
    agent_input = {"messages": [human]}
    if chat_id is None or "document_ids" in request.data:  # otherwise the chat keeps its scope
        agent_input["document_ids"] = document_ids

    def events():
        yield sse("start", {
            "chat": ChatSerializer(chat).data,
            "question": {"id": human.id, "role": "user", "content": question},
        })
        turn: list = []
        try:
            for mode, payload in get_agent().stream(agent_input, config, stream_mode=["messages", "updates"]):
                if mode == "messages":
                    chunk, metadata = payload
                    if metadata.get("langgraph_node") == "assistant" and isinstance(chunk, AIMessageChunk):
                        text = chunk.content if isinstance(chunk.content, str) else ""
                        if text:
                            yield sse("token", {"id": chunk.id, "text": text})
                    continue

                for node, update in (payload or {}).items():
                    if not update:
                        continue
                    for message in update.get("messages", []):
                        if isinstance(message, AIMessage) and message.tool_calls:
                            turn.append(message)
                            for call in message.tool_calls:
                                yield sse("search", {"query": call["args"].get("query", "")})
                        elif isinstance(message, ToolMessage):
                            turn.append(message)
                            yield sse("sources", {"sources": merge_sources([m for m in turn if isinstance(m, ToolMessage)])})
                        elif isinstance(message, AIMessage):
                            yield sse("answer", {"message": serialize_answer(message, turn)})
                    if node == "generate_title" and update.get("title"):
                        chat.title = update["title"][:255]
                        chat.save(update_fields=["title", "updated_at"])
                        yield sse("title", {"title": chat.title})
        except Exception as error:
            logger.exception(f"Chat {chat.id}: answering failed")
            yield sse("error", {"detail": describe_error(error), "code": "answer_failed"})
        Chat.objects.filter(pk=chat.pk).update(updated_at=timezone.now())
        yield sse("done", {})

    response = StreamingHttpResponse(events(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # nginx: don't hold tokens back
    return response
