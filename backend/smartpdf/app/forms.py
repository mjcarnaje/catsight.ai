from django import forms
from .models import PDF

class UploadPDFForm(forms.ModelForm):
    class Meta:
        model = PDF
        fields = ['title', 'file']

