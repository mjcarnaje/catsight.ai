from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.db.models import Case, When, Value, IntegerField
import json
import os
from pathlib import Path

from .constant import DocumentStatus, UserRole


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        # Validate MSU-IIT email domain
        if not email.endswith('@g.msuiit.edu.ph'):
            raise ValueError('Only @g.msuiit.edu.ph addresses allowed')

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', UserRole.SUPER_ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    email               = models.EmailField(_('email address'), unique=True)
    role                = models.CharField(
        max_length=20,
        choices=UserRole.choices(),
        default=UserRole.USER
    )
    avatar              = models.CharField(max_length=255, null=True, blank=True)
    google_id           = models.CharField(max_length=255, null=True, blank=True)
    is_onboarded        = models.BooleanField(default=False, help_text="Whether the user has completed the onboarding process")
    favorite_llm_models = models.JSONField(
        blank=True, 
        null=True,
        default=list,
        help_text="List of LLM model codes that this user has favorited"
    )

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def is_admin(self):
        return self.role in {UserRole.ADMIN, UserRole.SUPER_ADMIN}

    @property
    def is_super_admin(self):
        return self.role == UserRole.SUPER_ADMIN


# Define mapping for status ordering
STATUS_ORDER = {
    DocumentStatus.PENDING: 0,
    DocumentStatus.TEXT_EXTRACTING: 1,
    DocumentStatus.TEXT_EXTRACTED: 2,
    DocumentStatus.EMBEDDING_TEXT: 3,
    DocumentStatus.EMBEDDED_TEXT: 4,
    DocumentStatus.GENERATING_SUMMARY: 5,
    DocumentStatus.SUMMARY_GENERATED: 6,
    DocumentStatus.COMPLETED: 7,
}


class DocumentQuerySet(models.QuerySet):
    def ordered(self):
        # Annotate each document with its status priority and then order
        whens = [When(status=status.value, then=Value(order)) for status, order in STATUS_ORDER.items()]
        return self.annotate(
            status_priority=Case(*whens, default=Value(len(STATUS_ORDER)), output_field=IntegerField())
        ).order_by('status_priority', 'created_at')


class DocumentManager(models.Manager):
    def get_queryset(self):
        return DocumentQuerySet(self.model, using=self._db).ordered()


class Document(models.Model):
    title              = models.TextField(null=True, blank=True)
    summary            = models.TextField(null=True, blank=True)
    year               = models.IntegerField(null=True, blank=True)
    tags               = models.JSONField(null=True, blank=True)
    file               = models.CharField(max_length=1000, null=True, blank=True)
    file_name          = models.CharField(max_length=1000, null=True, blank=True)
    file_type          = models.CharField(max_length=100, null=True, blank=True)
    preview_image      = models.CharField(max_length=1000, null=True, blank=True)
    blurhash           = models.CharField(max_length=100, null=True, blank=True)
    status             = models.CharField(max_length=100, default=DocumentStatus.PENDING.value)
    is_failed          = models.BooleanField(default=False)
    task_id            = models.CharField(max_length=255, null=True, blank=True)
    markdown_converter = models.CharField(max_length=100, null=True, blank=True)
    summarization_model = models.CharField(max_length=100, default="")
    no_of_chunks       = models.IntegerField(default=0)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)
    uploaded_by        = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )

    objects = DocumentManager()  # apply ordering by status priority

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.title or f"Document {self.id}"

def save(self, *args, **kwargs):
        # Check if creation or status change
        is_create = self.pk is None
        old_status = None
        if not is_create:
            try:
                old_status = Document.objects.get(pk=self.pk).status
            except Document.DoesNotExist:
                is_create = True

        super().save(*args, **kwargs)

        if is_create:
            status_records = [
                DocumentStatusHistory(document=self, status=status.value, changed_at=None)
                for status in DocumentStatus
            ]
            # Set the initial status timestamp
            for record in status_records:
                if record.status == self.status:
                    record.changed_at = timezone.now()
            DocumentStatusHistory.objects.bulk_create(status_records)
        elif self.status != old_status:
            status_history = DocumentStatusHistory.objects.filter(document=self, status=self.status).first()
            if status_history:
                status_history.changed_at = timezone.now()
                status_history.save(update_fields=['changed_at'])
            else:
                DocumentStatusHistory.objects.create(
                    document=self,
                    status=self.status,
                    changed_at=timezone.now()
                )


class DocumentStatusHistory(models.Model):
    document   = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    status     = models.CharField(max_length=100)
    changed_at = models.DateTimeField(null=True)

    class Meta:
        ordering = ['-changed_at']
        indexes = [models.Index(fields=['changed_at'])]

    def __str__(self):
        return f"{self.document} → {self.status} at {self.changed_at.isoformat() if self.changed_at else 'not yet'}"

class DocumentFullText(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='full_text')
    text     = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.document} → {self.text[:100]}"

class Chat(models.Model):
    title = models.CharField(max_length=255, null=True, blank=True)
    document = models.ForeignKey(
        Document, 
        on_delete=models.CASCADE, 
        related_name='chats',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='chats'
    )

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['updated_at'])]

    def __str__(self):
        return f"{self.title or f'Chat {self.id}'} - {self.user.email}"
    
