from django.db import models
from pgvector.django import VectorField


class Document(models.Model):
    title = models.CharField(max_length=500, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    file = models.CharField(max_length=1000, null=True, blank=True)
    ocr_file = models.CharField(max_length=1000, null=True, blank=True)
    status = models.CharField(max_length=100, default="pending")
    no_of_chunks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
            models.Index(fields=['document', 'index']),
        ]
        ordering = ['document', 'index']
