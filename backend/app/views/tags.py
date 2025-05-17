from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from ..models import Tag
from ..serializers import TagSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tags(request):
    """Get all tags"""
    tags = Tag.objects.all()
    serializer = TagSerializer(tags, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_tag(request, tag_id):
    """Get single tag by ID"""
    tag = get_object_or_404(Tag, id=tag_id)
    serializer = TagSerializer(tag)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_tag(request):
    """Create a new tag"""
    serializer = TagSerializer(data=request.data)
    
    if serializer.is_valid():
        serializer.save(author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_tag(request, tag_id):
    """Update an existing tag"""
    tag = get_object_or_404(Tag, id=tag_id)
    
    # Check if user is the author of the tag
    if tag.author != request.user:
        return Response(
            {"detail": "You do not have permission to edit this tag."},
            status=status.HTTP_403_FORBIDDEN
        )
        
    # Use PATCH method behavior if PATCH request
    partial = request.method == 'PATCH'
    
    serializer = TagSerializer(tag, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_tag(request, tag_id):
    """Delete a tag"""
    tag = get_object_or_404(Tag, id=tag_id)
    
    # Check if user is the author of the tag
    if tag.author != request.user:
        return Response(
            {"detail": "You do not have permission to delete this tag."},
            status=status.HTTP_403_FORBIDDEN
        )
        
    tag.delete()
    return Response(status=status.HTTP_204_NO_CONTENT) 