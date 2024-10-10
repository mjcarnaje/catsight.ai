from django.shortcuts import render, redirect
from django.urls import reverse
from .forms import UploadPDFForm
from .utils import PDFUtils
from .tasks import process_pdf_ocr

def index(request):
    return render(request, "index.html")

def upload_pdf(request):
    if request.method == "POST":
        form = UploadPDFForm(request.POST, request.FILES)
        if form.is_valid():
            pdf = form.save(commit=False)
            pdf.file = PDFUtils.upload_pdf(request.FILES['file'], pdf.title)
            pdf.save()
            process_pdf_ocr.delay(pdf.id)  # Trigger the OCR task
            return redirect(reverse('upload_success'))
    else:
        form = UploadPDFForm()
    return render(request, "upload_pdf.html", {"form": form})

def upload_success(request):
    return render(request, "upload_success.html")