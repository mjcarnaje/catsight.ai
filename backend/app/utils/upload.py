import os
from django.conf import settings
from django.core.files.storage import default_storage
import logging

logger = logging.getLogger(__name__)

class UploadUtils:
    @staticmethod
    def upload_document(file, id):
        """
        Upload a document file and save it to the media root.
        """
        try:
            file_name = f"{id}_original.pdf"
            file_path = os.path.join('docs', str(id), file_name)
            
            # Ensure the directory exists
            directory = os.path.join(settings.MEDIA_ROOT, 'docs', str(id))
            os.makedirs(directory, exist_ok=True)
            
            # Use chunks for memory efficiency
            with default_storage.open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)
            
            # Verify file was saved correctly
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            if not os.path.exists(full_path):
                raise IOError(f"File failed to save at {full_path}")
            
            return file_path
            
        except Exception as e:
            logger.error(f"Error uploading document {id}: {str(e)}")
            raise
    

    @staticmethod
    def upload_ocr_document(file, id):
        """
        Upload a OCR document file and save it to the media root.
        """
        file_name = f"{id}_ocr.pdf"
        file_path = os.path.join('docs', str(id), file_name)

        # Ensure the directory exists
        directory = os.path.dirname(file_path)
        os.makedirs(os.path.join(settings.MEDIA_ROOT, directory), exist_ok=True)

        # Use default_storage to handle file saving
        with default_storage.open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)
        
        return file_path

    @staticmethod
    def delete_document(document_id):
        """
        Delete a document file and associated files.
        """
        file_path = os.path.join('docs', str(document_id))
        
        # Check if the directory exists
        if default_storage.exists(file_path):
            # List all files in the directory
            files = default_storage.listdir(file_path)[1]  # [1] to get files, not subdirectories
            
            # Delete each file in the directory
            for file in files:
                file_to_delete = os.path.join(file_path, file)
                default_storage.delete(file_to_delete)
            
            # After deleting all files, try to remove the directory
            try:
                default_storage.delete(file_path)
            except OSError:
                # If the directory is not empty or can't be deleted, log the error
                import logging
                logging.error(f"Could not delete directory: {file_path}")
        else:
            # If the directory doesn't exist, do nothing
            pass

    @staticmethod
    def get_document_file(document_id, file_type):
        """
        Get the file path for a specific file type (original or OCR) for a Documentby its ID.

        Args:
            pdf_id (int): The ID of the Document
            file_type (str): The type of file ('original' or 'ocr').

        Returns:
            str: The full file path.

        Raises:
            ValueError: If an invalid file_type is provided.
        """
        if file_type not in ['original', 'ocr']:
            raise ValueError("file_type must be either 'original' or 'ocr'")

        file_name = f"{document_id}_{file_type}.pdf"
        return os.path.join(settings.MEDIA_ROOT, 'docs', str(document_id), file_name)
    
    @staticmethod
    def delete_all_documents():
        """
        Forcefully delete all documents and associated files.
        """
        docs_path = os.path.join(settings.MEDIA_ROOT, 'docs')
        
        # Check if the directory exists
        if default_storage.exists(docs_path):
            # List all subdirectories and files in the 'docs' directory
            directories, files = default_storage.listdir(docs_path)
            
            # Delete each file in the 'docs' directory
            for file in files:
                file_to_delete = os.path.join(docs_path, file)
                default_storage.delete(file_to_delete)
            
            # Delete each subdirectory and its contents
            for directory in directories:
                dir_to_delete = os.path.join(docs_path, directory)
                # List all files in the subdirectory
                sub_files = default_storage.listdir(dir_to_delete)[1]  # [1] to get files, not subdirectories
                for sub_file in sub_files:
                    file_to_delete = os.path.join(dir_to_delete, sub_file)
                    default_storage.delete(file_to_delete)
                # Delete the subdirectory itself
                default_storage.delete(dir_to_delete)
            
            # After deleting all files and subdirectories, forcefully remove the 'docs' directory
            remaining_files = default_storage.listdir(docs_path)[1]  # [1] to get files, not subdirectories
            for remaining_file in remaining_files:
                file_to_delete = os.path.join(docs_path, remaining_file)
                default_storage.delete(file_to_delete)
            default_storage.delete(docs_path)
        else:
            # If the directory doesn't exist, do nothing
            pass

        os.makedirs(docs_path, exist_ok=True)
