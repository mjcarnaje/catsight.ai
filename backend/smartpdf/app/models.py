from django.db import models

# Create your models here.
class PDF(models.Model):
    title = models.CharField(max_length=500)
    file = models.FileField(upload_to="pdfs/")
    ocr_file = models.FileField(upload_to="pdfs/ocr/", null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    rawBody = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=100, default="pending") # uploaded, processing, completed, failed
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


