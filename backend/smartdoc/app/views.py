import logging
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Document
from .serializers import DocumentSerializer
from .tasks.tasks import generate_summary_task, ocr_doc_task, save_chunks_to_db, embed_text_task
from .utils.upload import UploadUtils
from django.http import FileResponse
logger = logging.getLogger(__name__)
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser

@api_view(['GET'])
def index(request):
    """
    Retrieve a list of all documents.
    """
    documents = Document.objects.all()
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_doc(request):
    """
    Handle multiple document uploads and initiate OCR and summary generation using Celery tasks.
    """
    uploaded_files = request.FILES.getlist('files')
    if not uploaded_files:
        return Response({"status": "error", "message": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

    response_data = []
    
    for file in uploaded_files:
        
        serializer = DocumentSerializer(data={'title': file.name})
        
        if serializer.is_valid():
            document = serializer.save(file=None)
            document.file = UploadUtils.upload_document(file, str(document.id))
            document.save()

            # Modify the task chain
            (ocr_doc_task.s(document.id) | 
             save_chunks_to_db.s() | 
             generate_summary_task.s() | 
             embed_text_task.s()).delay()

            response_data.append({"status": "success", "id": document.id, "filename": file.name})
        else:
            logger.error(f"Document upload failed for {file.name}: {serializer.errors}")
            response_data.append({"status": "error", "filename": file.name, "errors": serializer.errors})

    # Determine the appropriate status code
    if all(item["status"] == "success" for item in response_data):
        return Response(response_data, status=status.HTTP_201_CREATED)
    elif all(item["status"] == "error" for item in response_data):
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
    else:
        return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
    

@api_view(['GET'])
def get_doc(request, doc_id):
    """
    Retrieve a single document by its ID.
    """
    try:
        document= Document.objects.get(id=doc_id)
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
def delete_doc(request, doc_id):
    """
    Delete a document by its ID and remove associated files.
    """
    try:
        document= Document.objects.get(id=doc_id)
        UploadUtils.delete_document(doc_id)
        document.delete()
        logger.info(f"Documentdeleted successfully: {doc_id}")
        return Response({"status": "success", "message": "Documentdeleted successfully"}, status=status.HTTP_200_OK)
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting PDF: {str(e)}")
        return Response({"status": "error", "message": f"Error deleting PDF: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
def update_doc(request, doc_id):
    """
    Update the details of a specific document by its ID.
    """
    try:
        document= Document.objects.get(id=doc_id)
        serializer = DocumentSerializer(document, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Documentupdated successfully: {doc_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            logger.warning(f"Documentupdate failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_doc_original_file(request, doc_id):
    """
    Retrieve the original file for a document by its ID.
    """
    try:
        file_path = UploadUtils.get_document_file(doc_id, 'original')
        return FileResponse(open(file_path, 'rb'))
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        return Response({"status": "error", "message": f"Error retrieving {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_doc_ocr_file(request, doc_id):
    """
    Retrieve the OCR file for a document by its ID.
    """
    try:
        logger.info(f"Retrieving OCR file for PDF: {doc_id}")
        file_path = UploadUtils.get_document_file(doc_id, 'ocr')
        return FileResponse(open(file_path, 'rb'))
    except Document.DoesNotExist:
        logger.warning(f"Documentnot found: {doc_id}")
        return Response({"status": "error", "message": "Documentnot found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        return Response({"status": "error", "message": f"Error retrieving {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 

