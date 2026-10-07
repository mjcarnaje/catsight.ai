import logging
import uuid
from pathlib import Path

import requests
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.files.storage import default_storage
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..constant import UserRole
from ..models import User
from ..serializers import LoginSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer
from ..tasks.tasks import delete_expired_guests
from ..utils.permissions import AllowAny, IsAuthenticated

logger = logging.getLogger(__name__)

MAX_AVATAR_BYTES = 2 * 1024 * 1024


def session_for(user: User, status_code=status.HTTP_200_OK) -> Response:
    refresh = RefreshToken.for_user(user)
    return Response(
        {"user": UserSerializer(user).data, "tokens": {"access": str(refresh.access_token), "refresh": str(refresh)}},
        status=status_code,
    )


class GuestThrottle(AnonRateThrottle):
    """Guest accounts per visitor IP; Cloudflare puts the real client IP in CF-Connecting-IP."""

    scope = "guest"
    rate = "6/hour"

    def get_ident(self, request):
        return request.META.get("HTTP_CF_CONNECTING_IP") or super().get_ident(request)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return session_for(serializer.save(), status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(email=serializer.validated_data["email"].lower(), password=serializer.validated_data["password"])
    if user is None:
        return Response({"detail": "That email and password don't match."}, status=status.HTTP_401_UNAUTHORIZED)
    return session_for(user)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([GuestThrottle])
def guest(request):
    """One-click demo access: a temporary account with the demo's limits."""
    if not settings.GUEST_ACCESS:
        return Response({"detail": "Guest access is turned off."}, status=status.HTTP_403_FORBIDDEN)
    handle = uuid.uuid4().hex[:10]
    user = User.objects.create_user(
        email=f"guest-{handle}@guest.catsight.local",
        username=f"guest-{handle}",
        password=None,  # unusable: guests only ever hold the tokens issued here
        first_name="Guest",
        role=UserRole.GUEST.value,
    )
    delete_expired_guests.delay()
    return session_for(user, status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def google(request):
    """Exchange a Google OAuth code for a session."""
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        return Response({"detail": "Google sign-in isn't configured."}, status=status.HTTP_404_NOT_FOUND)
    code = request.data.get("code") or request.data.get("token")
    if not code:
        return Response({"detail": "Missing authorization code."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        tokens = requests.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }, timeout=15).json()
        if "error" in tokens:
            return Response({"detail": tokens.get("error_description", tokens["error"])}, status=status.HTTP_400_BAD_REQUEST)
        info = id_token.verify_oauth2_token(tokens["id_token"], google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID)
    except (requests.RequestException, ValueError, KeyError) as e:
        logger.warning(f"Google sign-in failed: {e}")
        return Response({"detail": "Google sign-in failed. Try again."}, status=status.HTTP_400_BAD_REQUEST)

    email = info["email"].lower()
    domains = settings.ALLOWED_EMAIL_DOMAINS
    if domains and email.rsplit("@", 1)[-1] not in domains:
        return Response(
            {"detail": f"Sign in with an address at {', '.join('@' + d for d in domains)}."},
            status=status.HTTP_403_FORBIDDEN,
        )
    user, created = User.objects.get_or_create(email=email, defaults={
        "username": email,
        "first_name": info.get("given_name", ""),
        "last_name": info.get("family_name", ""),
        "avatar": info.get("picture", ""),
        "google_id": info["sub"],
    })
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    elif not user.google_id:
        user.google_id = info["sub"]
        user.save(update_fields=["google_id"])
    return session_for(user)


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        serializer = ProfileUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if avatar := request.FILES.get("avatar"):
            if avatar.size > MAX_AVATAR_BYTES or not (avatar.content_type or "").startswith("image/"):
                return Response({"detail": "Avatars must be images up to 2 MB."}, status=status.HTTP_400_BAD_REQUEST)
            name = f"avatars/{uuid.uuid4().hex}{Path(avatar.name).suffix.lower()[:5]}"
            user.avatar = default_storage.save(name, avatar)
            user.save(update_fields=["avatar"])
        return Response(UserSerializer(user).data)
