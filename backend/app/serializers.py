from django.conf import settings
from rest_framework import serializers

from .models import Chat, Document, DocumentStatusHistory, Tag, User
from .services.storage import signed_file_url
from .utils.permissions import can_modify


def _absolute_media(path: str) -> str:
    if not path or path.startswith(("http://", "https://")):
        return path
    return f"{settings.MEDIA_URL}{path.lstrip('/')}"


class UserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "avatar", "is_guest", "is_admin", "date_joined"]
        read_only_fields = fields

    def get_avatar(self, user: User) -> str:
        return _absolute_media(user.avatar)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, email: str) -> str:
        email = email.lower()
        domains = settings.ALLOWED_EMAIL_DOMAINS
        if domains and email.rsplit("@", 1)[-1] not in domains:
            raise serializers.ValidationError(f"Use an email address at {', '.join('@' + d for d in domains)}.")
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def create(self, data):
        return User.objects.create_user(
            email=data["email"],
            username=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class TagSerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Tag
        fields = ["id", "name", "description", "document_count", "created_at", "updated_at"]
        read_only_fields = ["id", "document_count", "created_at", "updated_at"]


class TagRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]


class StatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentStatusHistory
        fields = ["status", "is_failed", "changed_at"]


class DocumentSerializer(serializers.ModelSerializer):
    """List view of a document (no summary or full text)."""

    tags = TagRefSerializer(many=True, read_only=True)
    preview_url = serializers.SerializerMethodField()
    uploaded_by = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "title", "file_name", "reference_number", "year", "issued_on", "tags",
            "status", "is_failed", "error_message", "progress_done", "progress_total",
            "page_count", "chunk_count", "file_size", "preview_url", "blurhash", "is_private",
            "uploaded_by", "can_edit", "created_at", "updated_at", "processed_at",
        ]

    def get_preview_url(self, document: Document) -> str:
        return signed_file_url(document.id, "preview") if document.preview_image else ""

    def get_uploaded_by(self, document: Document):
        user = document.uploaded_by
        if user is None:
            return None
        name = f"{user.first_name} {user.last_name}".strip() or user.email.split("@")[0]
        return {"id": user.id, "name": name, "is_guest": user.is_guest}

    def get_can_edit(self, document: Document) -> bool:
        request = self.context.get("request")
        return bool(request and can_modify(request.user, document))


class DocumentDetailSerializer(DocumentSerializer):
    status_history = StatusEventSerializer(many=True, read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + [
            "summary", "questions", "extractor", "summarization_model", "status_history", "file_url",
        ]

    def get_file_url(self, document: Document) -> str:
        return signed_file_url(document.id, "pdf") if document.file else ""


class DocumentUpdateSerializer(serializers.ModelSerializer):
    """Fields a person may correct after the summarizer filled them."""

    tag_ids = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True, source="tags", required=False)

    class Meta:
        model = Document
        fields = ["title", "summary", "reference_number", "year", "issued_on", "tag_ids"]


class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = ["id", "title", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
