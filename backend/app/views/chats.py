import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.core.paginator import Paginator

from ..models import Chat
from ..serializers import ChatSerializer
from ..utils.permissions import IsAuthenticated, IsOwnerOrAdmin

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recent_chats(request):
    """
    Retrieve recent chat sessions for the authenticated user.
    """
    try:
        limit = int(request.GET.get('limit', 5))
        user = request.user
        
        logger.info(f"Fetching recent chats for user: {user.email}, limit: {limit}")
        
        # Get the most recent chats by updated_at
        chats = Chat.objects.filter(user=user).order_by('-updated_at')[:limit]
        logger.info(f"Found {len(chats)} chats for user {user.email}")
        
        serializer = ChatSerializer(chats, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_recent_chats: {str(e)}", exc_info=True)
        return Response(
        {"status": "error", "message": f"Failed to retrieve recent chats: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chats(request):
    """
    Retrieve all chats for the authenticated user.
    """
    try:
        chats = Chat.objects.filter(user=request.user).order_by('-updated_at')
        serializer = ChatSerializer(chats, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_chats: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Failed to retrieve chats: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat(request, chat_id):
    """
    Retrieve a single chat by its ID.
    """
    try:
        logger.info(f"Retrieving chat with ID: {chat_id} for user: {request.user.email}")
        chat = Chat.objects.get(id=chat_id, user=request.user)
        serializer = ChatSerializer(chat)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Chat.DoesNotExist:
        logger.warning(f"Chat not found: ID {chat_id} for user {request.user.email}")
        return Response({"status": "error", "message": "Chat not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving chat {chat_id}: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Error retrieving chat: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

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
        return Response({"chat_id": chat.id}, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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