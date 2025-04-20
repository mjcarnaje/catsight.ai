from django.db import models
from pgvector.django import HnswIndex, VectorField
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _

from .constant import DocumentStatus, UserRole


class LLM_MODELS:
    LLAMA_3_2_1B = 'llama3.2:1b'
    DEEPSEEK_R1_1_5B = 'deepseek-r1:1.5b'
    
    @classmethod
    def choices(cls):
        return [
            (cls.LLAMA_3_2_1B, 'Llama 3.2 1B'),
            (cls.DEEPSEEK_R1_1_5B, 'DeepSeek R1 1.5B'),
        ]


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        
        # Validate MSU-IIT email domain
        if not email.endswith('@g.msuiit.edu.ph'):
            raise ValueError('Only users with @g.msuiit.edu.ph email addresses are allowed')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', UserRole.SUPER_ADMIN)
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    email = models.EmailField(_('email address'), unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices(), default=UserRole.USER)
    avatar = models.CharField(max_length=255, null=True, blank=True)
    google_id = models.CharField(max_length=255, null=True, blank=True)
    favorite_llm_models = models.TextField(null=True, blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    objects = UserManager()
    
    def __str__(self):
        return self.email
    
    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN.value or self.role == UserRole.SUPER_ADMIN.value
    
    @property
    def is_super_admin(self):
        return self.role == UserRole.SUPER_ADMIN.value


class Document(models.Model):
    title = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    file = models.CharField(max_length=1000, null=True, blank=True)
    ocr_file = models.CharField(max_length=1000, null=True, blank=True)
    status = models.CharField(max_length=100, default=DocumentStatus.PENDING)
    is_failed = models.BooleanField(default=False)
    task_id = models.CharField(max_length=255, null=True, blank=True)
    markdown_converter = models.CharField(max_length=100, null=True, blank=True)
    no_of_chunks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')

    def __str__(self):
        return self.title if self.title else f"Document {self.id}"

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    index = models.IntegerField()
    content = models.TextField()
    embedding_vector = VectorField(dimensions=1024, editable=False, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chunk {self.index} of {self.document.title if self.document.title else 'Unnamed Document'}"

    class Meta:
        indexes = [
            HnswIndex(
                name='embedding_vector_index',
                fields=['embedding_vector'],
                m=16,
                ef_construction=128,
                opclasses=['vector_cosine_ops'],
            ),
        ]
