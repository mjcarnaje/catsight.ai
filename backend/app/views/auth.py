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

logger = logging.getLogger(__name__)


from app.models import User, LLM_MODELS
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
                # Exchange auth code for tokens
                token_endpoint = "https://oauth2.googleapis.com/token"
                # Must match what's configured in Google Cloud Console and frontend
                logger.info(os.getenv('GOOGLE_REDIRECT_URI'))
                redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/auth/login')
                
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
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request):
        """
        Update the authenticated user's profile
        """
        data = request.data.copy()
        
        # Log request data for debugging
        logger.info(f"PATCH Profile request data: {data}")
        
        # Handle avatar upload if included
        if 'avatar_file' in request.FILES:
            avatar_file = request.FILES['avatar_file']
            filename = f"avatars/{uuid.uuid4()}{os.path.splitext(avatar_file.name)[1]}"
            path = default_storage.save(filename, ContentFile(avatar_file.read()))
            full_url = request.build_absolute_uri(settings.MEDIA_URL + path)
            data['avatar'] = full_url
        
        # Handle favorite_llm_models - convert to LLMModel instances if provided
        if 'favorite_llm_models' in data:
            # Convert model codes to model instances
            try:
                from app.models import LLMModel
                model_codes = data['favorite_llm_models']
                if isinstance(model_codes, str):
                    # Handle potential string JSON input
                    try:
                        model_codes = json.loads(model_codes)
                    except json.JSONDecodeError:
                        model_codes = [model_codes]  # Single string value
                
                # Clear current favorites and set new ones
                request.user.favorite_llm_models.clear()
                if model_codes:
                    models = LLMModel.objects.filter(code__in=model_codes)
                    request.user.favorite_llm_models.add(*models)
                
                # Remove from data since we've handled it manually
                data.pop('favorite_llm_models')
            except Exception as e:
                logger.error(f"Error updating favorite_llm_models: {e}")
                return Response(
                    {"detail": "Failed to update favorite models"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = UserSerializer(request.user, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Log validation errors
        logger.error(f"Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 