from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from django.db.models import Q
from django.utils import timezone
from pgvector.django import VectorField

from .constant import DocumentStatus, OrgRole, Provider, UsageKind, UserRole


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.SUPER_ADMIN.value)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    email = models.EmailField("email address", unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices(), default=UserRole.USER.value)
    first_name = models.CharField(max_length=255, blank=True, default="")
    last_name = models.CharField(max_length=255, blank=True, default="")
    avatar = models.CharField(max_length=255, blank=True, default="")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def is_super_admin(self) -> bool:
        return self.role == UserRole.SUPER_ADMIN.value

    @property
    def is_guest(self) -> bool:
        return self.role == UserRole.GUEST.value


class Organization(models.Model):
    """A tenant: its own library, members, tags and model provider.

    The provider settings live here. `ai_api_key` is Fernet ciphertext (see
    services/secrets.py) and is never serialized; blank model names mean the
    provider's default (settings.PROVIDER_DEFAULTS). No provider means the
    organization is read-only: nothing can be processed, searched or asked.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=60, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    ai_provider = models.CharField(max_length=20, choices=Provider.choices(), blank=True, default="")
    ai_api_key = models.TextField(blank=True, default="")
    ai_api_key_last4 = models.CharField(max_length=4, blank=True, default="")
    chat_model = models.CharField(max_length=200, blank=True, default="")
    fast_model = models.CharField(max_length=200, blank=True, default="")
    ocr_model = models.CharField(max_length=200, blank=True, default="")
    embedding_model = models.CharField(max_length=200, blank=True, default="")
    reranker_model = models.CharField(max_length=200, blank=True, default="")
    # The server's own Ollama is a shared resource: only the super admin can open it to an org
    ollama_allowed = models.BooleanField(default=False)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=OrgRole.choices(), default=OrgRole.MEMBER.value)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [models.UniqueConstraint(fields=["user", "organization"], name="unique_membership")]

    def __str__(self):
        return f"{self.user} in {self.organization} ({self.role})"

    @property
    def is_admin(self) -> bool:
        return self.role == OrgRole.ADMIN.value

    @property
    def is_guest(self) -> bool:
        return self.role == OrgRole.GUEST.value


class Invitation(models.Model):
    """An emailed, one-time link to join an organization.

    Only the SHA-256 of the token is stored; the token itself exists in the
    email (and the link shown once to the admin who created it).
    """

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=OrgRole.choices(), default=OrgRole.MEMBER.value)
    token_hash = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.email} -> {self.organization} ({self.role})"

    @property
    def is_pending(self) -> bool:
        return self.accepted_at is None and self.expires_at > timezone.now()


class Tag(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="tags")

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="unique_tag_name_per_org")]

    def __str__(self):
        return self.name


class DocumentQuerySet(models.QuerySet):
    def visible_to(self, membership: "Membership"):
        """The organization's library plus the member's own private uploads (org admins see everything)."""
        docs = self.filter(organization_id=membership.organization_id)
        if membership.is_admin:
            return docs
        return docs.filter(Q(is_private=False) | Q(uploaded_by_id=membership.user_id))


class Document(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="documents")

    # --- Catalogue (filled by the summarizer, editable) ---
    title = models.TextField(blank=True, default="")
    summary = models.TextField(blank=True, default="")
    year = models.IntegerField(null=True, blank=True)
    issued_on = models.DateField(null=True, blank=True)
    reference_number = models.CharField(max_length=255, blank=True, default="")  # the document's own number, if it has one
    tags = models.ManyToManyField(Tag, related_name="documents", blank=True)
    questions = models.JSONField(default=list, blank=True)  # suggested questions this document answers

    # --- File ---
    file = models.CharField(max_length=1000, blank=True, default="")  # path under MEDIA_ROOT
    file_name = models.CharField(max_length=1000, blank=True, default="")
    file_size = models.PositiveIntegerField(default=0)
    file_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)  # SHA-256 of the bytes
    page_count = models.PositiveIntegerField(default=0)
    preview_image = models.CharField(max_length=1000, blank=True, default="")
    blurhash = models.CharField(max_length=100, blank=True, default="")

    # --- Pipeline ---
    status = models.CharField(max_length=20, choices=DocumentStatus.choices(), default=DocumentStatus.QUEUED.value)
    is_failed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, default="")
    progress_done = models.PositiveIntegerField(default=0)  # e.g. pages read so far
    progress_total = models.PositiveIntegerField(default=0)
    extractor = models.CharField(max_length=20, blank=True, default="")
    summarization_model = models.CharField(max_length=100, blank=True, default="")
    chunk_count = models.PositiveIntegerField(default=0)
    # "<provider>:<model>" that embedded this document's chunks. Search compares only
    # vectors from the organization's current embedding model (see services/search.py).
    embedding_model = models.CharField(max_length=250, blank=True, default="")
    task_id = models.CharField(max_length=255, blank=True, default="")
    processed_at = models.DateTimeField(null=True, blank=True)

    # Private documents are only visible to their uploader (and admins). Public-demo
    # uploads by non-admins are private so visitors can't change the shared library.
    is_private = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploaded_documents")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DocumentQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["year"]),
            models.Index(fields=["organization", "file_hash"]),
        ]

    def __str__(self):
        return self.title or self.file_name or f"Document {self.id}"

    @property
    def is_ready(self) -> bool:
        return self.status == DocumentStatus.READY.value and not self.is_failed


class DocumentStatusHistory(models.Model):
    """Append-only log of pipeline transitions (shown as the document's timeline)."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="status_history")
    status = models.CharField(max_length=20)
    is_failed = models.BooleanField(default=False)
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["changed_at", "id"]

    def __str__(self):
        return f"{self.document_id} -> {self.status} at {self.changed_at:%Y-%m-%d %H:%M:%S}"


class DocumentFullText(models.Model):
    """The extracted Markdown, with <!-- page:N --> markers between pages."""

    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name="fulltext")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.document} → {self.text[:100]}"


class DocumentChunk(models.Model):
    """A searchable passage: its text, an embedding and a full-text index.

    `context` is a short header (document title, reference number, year, section)
    prepended when embedding and indexing, so a passage like "...is hereby
    designated as Director..." is still found by a question about the document
    it belongs to.

    The embedding column has no fixed dimension and no ANN index on purpose:
    at demo scale an exact scan is fast and never drops filtered results the way
    an approximate (HNSW) index can. EMBEDDING_DIMENSIONS is enforced in code.
    """

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    index = models.PositiveIntegerField()
    page = models.PositiveIntegerField(null=True, blank=True)
    section = models.CharField(max_length=255, blank=True, default="")
    context = models.CharField(max_length=500, blank=True, default="")
    text = models.TextField()
    embedding = VectorField()
    search_vector = SearchVectorField(null=True)

    class Meta:
        ordering = ["document_id", "index"]
        constraints = [models.UniqueConstraint(fields=["document", "index"], name="unique_chunk_index")]
        indexes = [GinIndex(fields=["search_vector"], name="chunk_search_vector_gin")]

    def __str__(self):
        return f"{self.document_id}#{self.index} (p. {self.page})"


class Chat(models.Model):
    title = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chats")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="chats")

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["user", "organization", "-updated_at"])]

    def __str__(self):
        return self.title or f"Chat {self.id}"

    @property
    def thread_id(self) -> str:
        return f"thread_{self.id}"


class UsageEvent(models.Model):
    """What each user consumed, for the public-demo limits.

    Kept when a user (or guest) is deleted so the library-wide page budget can't
    be reset by deleting accounts.
    """

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="usage_events")
    # The organization whose limits the use counts against (kept if the org is deleted)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, related_name="+")
    kind = models.CharField(max_length=20, choices=[(k.value, k.name.title()) for k in UsageKind])
    amount = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [models.Index(fields=["user", "kind", "created_at"])]

    def __str__(self):
        return f"{self.user_id} {self.kind} x{self.amount} at {self.created_at:%Y-%m-%d %H:%M}"
