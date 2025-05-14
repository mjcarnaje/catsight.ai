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
    Retrieve all chats for the authenticated user with pagination.
    """
    try:
        page_size = int(request.GET.get('page_size', 10))
        page_number = int(request.GET.get('page', 1))

        # Get all chats for the user ordered by most recent
        chats = Chat.objects.filter(user=request.user).order_by('-updated_at')
        
        # Create paginator instance
        paginator = Paginator(chats, page_size)
        
        try:
            paginated_chats = paginator.page(page_number)
        except Exception as e:
            logger.warning(f"Invalid page number {page_number}: {str(e)}")
            return Response(
                {"status": "error", "message": "Invalid page number"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Serialize the paginated data
        serializer = ChatSerializer(paginated_chats, many=True)
        
        # Prepare pagination metadata
        response_data = {
            "results": serializer.data,
            "total_pages": paginator.num_pages,
            "current_page": page_number,
            "total_count": paginator.count,
            "has_next": paginated_chats.has_next(),
            "has_previous": paginated_chats.has_previous(),
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    except ValueError as e:
        logger.error(f"Invalid pagination parameters: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": "Invalid pagination parameters"},
            status=status.HTTP_400_BAD_REQUEST
        )
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chats_count(request):
    """
    Return the total count of chats in the system.
    """
    try:
        count = Chat.objects.count()
        return Response({"count": count}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting chat count: {str(e)}", exc_info=True)
        return Response(
            {"status": "error", "message": f"Failed to get chat count: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 