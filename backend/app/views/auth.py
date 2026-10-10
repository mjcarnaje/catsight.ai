import io
import logging
import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from PIL import Image
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from ..constant import OrgRole, UserRole
from ..models import Membership, Organization, User
from ..serializers import LoginSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer
from ..tasks.tasks import delete_expired_guests
from ..utils.permissions import AllowAny, IsAuthenticated

logger = logging.getLogger(__name__)

MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_AVATAR_PIXELS = 4000 * 4000


def session_for(user: User, status_code=status.HTTP_200_OK) -> Response:
    refresh = RefreshToken.for_user(user)
    return Response(
        {"user": UserSerializer(user).data, "tokens": {"access": str(refresh.access_token), "refresh": str(refresh)}},
        status=status_code,
    )


class ClientIPThrottle(AnonRateThrottle):
    """Per visitor IP; Cloudflare puts the real client IP in CF-Connecting-IP."""

    def get_ident(self, request):
        return request.META.get("HTTP_CF_CONNECTING_IP") or super().get_ident(request)


class GuestThrottle(ClientIPThrottle):
    scope = "guest"
    rate = "6/hour"


class SignInThrottle(ClientIPThrottle):
    """Slows password guessing and mass account creation."""

    scope = "sign_in"
    rate = "20/hour"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SignInThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return session_for(serializer.save(), status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SignInThrottle])
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
    """One-click demo access: a temporary account in the demo organization, with the demo's limits."""
    if not settings.GUEST_ACCESS:
        return Response({"detail": "Guest access is turned off."}, status=status.HTTP_403_FORBIDDEN)
    organization = Organization.objects.filter(slug=settings.DEMO_ORG).first()
    if organization is None:
        logger.warning(f"Guest sign-in refused: no organization with the slug DEMO_ORG={settings.DEMO_ORG!r}")
        return Response(
            {"detail": "The demo isn't set up yet. Try again later.", "code": "demo_unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    handle = uuid.uuid4().hex[:10]
    with transaction.atomic():
        user = User.objects.create_user(
            email=f"guest-{handle}@guest.catsight.local",
            username=f"guest-{handle}",
            password=None,  # unusable: guests only ever hold the tokens issued here
            first_name="Guest",
            role=UserRole.GUEST.value,
        )
        Membership.objects.create(user=user, organization=organization, role=OrgRole.GUEST.value)
    delete_expired_guests.delay()
    return session_for(user, status.HTTP_201_CREATED)


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
            try:
                image = _decode_avatar(avatar)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            # Re-encoded and saved under our own name and extension: the uploaded bytes,
            # filename and content type are never served, so an SVG/HTML file can't
            # smuggle script onto the app's origin.
            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", quality=85)
            user.avatar = default_storage.save(f"avatars/{uuid.uuid4().hex}.webp", ContentFile(buffer.getvalue()))
            user.save(update_fields=["avatar"])
        return Response(UserSerializer(user).data)


def _decode_avatar(upload) -> Image.Image:
    """A real raster image, square-cropped to at most 256 px; raises ValueError otherwise."""
    if upload.size > MAX_AVATAR_BYTES:
        raise ValueError("Avatars can be up to 2 MB.")
    try:
        image = Image.open(upload)  # reads the header only
        if image.format not in {"PNG", "JPEG", "WEBP", "GIF"}:
            raise ValueError
        # A tiny file can declare enormous dimensions; refuse before decoding pixels
        if image.width * image.height > MAX_AVATAR_PIXELS:
            raise ValueError
        image.verify()  # checks the structure without decoding pixels
        upload.seek(0)
        image = Image.open(upload)
        image.draft("RGB", (512, 512))  # JPEG: decode at reduced size
        image = image.convert("RGB")
    except Exception:
        raise ValueError("Avatars must be PNG, JPEG, WebP or GIF images up to 4000 × 4000 pixels.")
    side = min(image.size)
    left, top = (image.width - side) // 2, (image.height - side) // 2
    return image.crop((left, top, left + side, top + side)).resize((256, 256))
