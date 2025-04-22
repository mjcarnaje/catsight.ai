import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.core.paginator import Paginator

from ..models import Chat, ChatMessage
from ..serializers import ChatSerializer, ChatMessageSerializer
from ..utils.permissions import IsAuthenticated, IsOwnerOrAdmin

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recent_chats(request):
    """
    Retrieve recent chat sessions for the authenticated user.
    """
    limit = int(request.GET.get('limit', 5))
    user = request.user
    
    # Get the most recent chats by updated_at
    chats = Chat.objects.filter(user=user).order_by('-updated_at')[:limit]
    
    serializer = ChatSerializer(chats, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat(request, chat_id):
    """
    Retrieve a single chat by its ID.
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        serializer = ChatSerializer(chat)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Chat.DoesNotExist:
        return Response({"status": "error", "message": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_messages(request, chat_id):
    """
    Retrieve all messages for a specific chat.
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        messages = chat.messages.all()
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Chat.DoesNotExist:
        return Response({"status": "error", "message": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_chat(request):
    """
    Create a new chat session.
    """
    data = request.data.copy()
    data['user'] = request.user.id
    
    serializer = ChatSerializer(data=data)
    if serializer.is_valid():
        chat = serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsOwnerOrAdmin])
def update_chat(request, chat_id):
    """
    Update an existing chat (e.g., change the title).
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        serializer = ChatSerializer(chat, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Chat.DoesNotExist:
        return Response({"status": "error", "message": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsOwnerOrAdmin])
def delete_chat(request, chat_id):
    """
    Delete a chat session and all its messages.
    """
    try:
        chat = Chat.objects.get(id=chat_id, user=request.user)
        chat.delete()
        return Response({"status": "success", "message": "Chat deleted successfully"}, status=status.HTTP_200_OK)
    except Chat.DoesNotExist:
        return Response({"status": "error", "message": "Chat not found"}, status=status.HTTP_404_NOT_FOUND) 