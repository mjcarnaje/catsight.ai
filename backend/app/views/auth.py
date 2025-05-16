from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from google.auth.transport import requests as google_requests
from django.conf import settings
import requests
import json
import os
import logging
import uuid
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from pathlib import Path

logger = logging.getLogger(__name__)


from app.models import User
from app.serializers import (
    UserSerializer, 
    RegisterSerializer, 
    LoginSerializer, 
    GoogleAuthSerializer
)
from app.utils.permissions import IsAuthenticated, AllowAny


def get_tokens_for_user(user):
    """
    Generate JWT tokens for a user
    """
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'tokens': tokens
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get('email')
            password = serializer.validated_data.get('password')
            user = authenticate(email=email, password=password)
            
            if user is not None:
                tokens = get_tokens_for_user(user)
                return Response({
                    'user': UserSerializer(user).data,
                    'tokens': tokens
                }, status=status.HTTP_200_OK)
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if serializer.is_valid():
            code = serializer.validated_data.get('token')
            
            try:
                token_endpoint = "https://oauth2.googleapis.com/token"
                redirect_uri = "https://catsigthai.ngrok.app/auth/login"
                
                token_data = {
                    'code': code,
                    'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
                    'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    'redirect_uri': redirect_uri,
                    'grant_type': 'authorization_code'
                }
                
                # Make the token exchange request
                token_response = requests.post(token_endpoint, data=token_data)
                token_json = token_response.json()
                
                if 'error' in token_json:
                    return Response({
                        'detail': f"Google auth error: {token_json.get('error_description', token_json['error'])}"
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Get ID token from response
                id_token_value = token_json['id_token']
                
                # Verify the ID token
                idinfo = id_token.verify_oauth2_token(
                    id_token_value,
                    google_requests.Request(),
                    settings.GOOGLE_OAUTH_CLIENT_ID
                )
                
                # Check if the email domain is allowed
                email = idinfo['email']
                if not email.endswith('@g.msuiit.edu.ph'):
                    return Response({
                        'detail': 'Only users with @g.msuiit.edu.ph email addresses are allowed'
                    }, status=status.HTTP_403_FORBIDDEN)
                
                # Check if the user exists
                try:
                    user = User.objects.get(email=email)
                    # Update Google ID if it's not set
                    if not user.google_id:
                        user.google_id = idinfo['sub']
                        user.save()
                except User.DoesNotExist:
                    # Create a new user
                    username = email.split('@')[0]
                    first_name = idinfo.get('given_name', '')
                    last_name = idinfo.get('family_name', '')
                    picture = idinfo.get('picture', '')
                    
                    user = User.objects.create_user(
                        email=email,
                        username=username,
                        first_name=first_name,
                        last_name=last_name,
                        avatar=picture,
                        google_id=idinfo['sub'],
                        password=None  # No password for Google users
                    )
                
                # Generate tokens
                tokens = get_tokens_for_user(user)
                return Response({
                    'user': UserSerializer(user).data,
                    'tokens': tokens
                }, status=status.HTTP_200_OK)
                
            except ValueError as e:
                return Response({'detail': f'Invalid token: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'detail': f'Authentication error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        """
        Get the authenticated user's profile
        """
        serializer = UserSerializer(request.user)
        user_data = serializer.data
        full_url = f"https://catsightai.ngrok.app{settings.MEDIA_URL}{user_data['avatar']}"
        user_data['avatar'] = full_url
        return Response(user_data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        """
        Update the authenticated user's profile
        """
        data = request.data.copy()
        
        logger.info(f"PATCH Profile request data: {data}")
        
        if 'avatar' in request.FILES:
            avatar_file = request.FILES['avatar']
            extension = os.path.splitext(avatar_file.name)[1]
            filename = f"avatars/{uuid.uuid4()}{extension}"
            path = default_storage.save(filename, ContentFile(avatar_file.read()))
            data['avatar'] = path
        
        serializer = UserSerializer(request.user, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            user_data = serializer.data
            full_url = f"https://catsightai.ngrok.app{settings.MEDIA_URL}{user_data['avatar']}"
            user_data['avatar'] = full_url
            return Response(user_data, status=status.HTTP_200_OK)
        
        logger.error(f"Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 