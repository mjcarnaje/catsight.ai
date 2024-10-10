from celery import shared_task
from .models import PDF
from .utils import PDFUtils

@shared_task
def process_pdf_ocr(pdf_id):
    try:
        pdf = PDF.objects.get(id=pdf_id)
        pdf.status = "processing"
        pdf.save()
        
        PDFUtils.ocr_pdf(pdf)

        process_pdf_description.delay(pdf_id)
    except PDF.DoesNotExist:
        print(f"PDF with id {pdf_id} not found")
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")

@shared_task
def process_pdf_description(pdf_id):
    try:
        pdf = PDF.objects.get(id=pdf_id)
        PDFUtils.make_description(pdf)
    except PDF.DoesNotExist:
        print(f"PDF with id {pdf_id} not found")
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")


