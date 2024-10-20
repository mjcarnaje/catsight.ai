from django.db import models

class Document(models.Model):
    title = models.CharField(max_length=500, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    file = models.CharField(max_length=255, null=True, blank=True)
    ocr_file = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=100, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE)
    index = models.IntegerField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    embedding_vector = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"Chunk {self.index} of {self.document.title}"
