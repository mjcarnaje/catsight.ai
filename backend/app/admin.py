from django.contrib import admin
from .models import User, Document, DocumentChunk

admin.site.register(User)
admin.site.register(Document)
admin.site.register(DocumentChunk)
