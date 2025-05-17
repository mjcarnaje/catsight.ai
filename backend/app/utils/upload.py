import logging
import os
import io
from pdf2image import convert_from_path
from PIL import Image
from PyPDF2 import PdfReader

from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

# Try to import blurhash, supporting both popular Python libraries
try:
    import blurhash
except ImportError:
    try:
        import blurhash_python as blurhash
        logger.warning("Using blurhash_python instead of blurhash")
    except ImportError:
        logger.error("No blurhash library available, preview generation will continue without blurhash")
        blurhash = None

class UploadUtils:
    @staticmethod
    def upload_document(file, id):
        """
        Upload a document file, save it to the media root, and generate preview image with blurhash.
        Returns a tuple of (file_path, preview_image, blurhash_string, page_count)
        """
        try:
            file_name = f"{id}_original.pdf"
            directory = os.path.join(settings.MEDIA_ROOT, 'docs', str(id))
            os.makedirs(directory, exist_ok=True)
            
            file_path = os.path.join('docs', str(id), file_name)
            full_file_path = os.path.join(settings.MEDIA_ROOT, file_path)
            
            logger.info(f"Saving document to: {full_file_path}")
            
            # Use chunks for memory efficiency
            with default_storage.open(full_file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)
            
            # Verify file was saved correctly
            if not os.path.exists(full_file_path):
                raise IOError(f"File failed to save at {full_file_path}")
            
            logger.info(f"Successfully saved document at {full_file_path}")
            
            # Extract the page count from the PDF
            page_count = 0
            try:
                with open(full_file_path, 'rb') as pdf_file:
                    reader = PdfReader(pdf_file)
                    page_count = len(reader.pages)
                logger.info(f"PDF page count: {page_count}")
            except Exception as e:
                logger.error(f"Error extracting page count: {str(e)}", exc_info=True)
            
            # Generate preview image and blurhash
            preview_path, blurhash_string = UploadUtils.generate_preview_and_blurhash(id, full_file_path)
            logger.info(f"Preview generation results: path={preview_path}, blurhash={blurhash_string is not None}")
            
            return file_path, preview_path, blurhash_string, page_count
            
        except Exception as e:
            logger.error(f"Error uploading document {id}: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def generate_preview_and_blurhash(doc_id, file_path):
        """
        Generate a preview image from the first page of a PDF and calculate its blurhash.
        Returns a tuple of (preview_path, blurhash_string)
        """
        try:
            # Create the preview image directory
            preview_dir = os.path.join(settings.MEDIA_ROOT, 'docs', str(doc_id))
            os.makedirs(preview_dir, exist_ok=True)
            
            preview_filename = f"{doc_id}_preview.png"
            full_preview_path = os.path.join(preview_dir, preview_filename)
            
            logger.info(f"Generating preview from PDF: {file_path} -> {full_preview_path}")
            
            # Convert first page of PDF to image
            try:
                images = convert_from_path(file_path, first_page=1, last_page=1)
                logger.info(f"PDF conversion result: {len(images) if images else 0} pages extracted")
            except Exception as pdf_err:
                logger.error(f"PDF conversion error: {str(pdf_err)}", exc_info=True)
                return None, None
            
            if not images:
                logger.warning(f"No pages found in the PDF: {file_path}")
                return None, None
            
            first_page = images[0]
            
            # Save as PNG
            try:
                first_page.save(full_preview_path, 'PNG')
                logger.info(f"Preview image saved to {full_preview_path}")
            except Exception as img_err:
                logger.error(f"Error saving preview image: {str(img_err)}", exc_info=True)
                return None, None
            
            # Check if the blurhash module is available
            if not blurhash:
                logger.warning("Blurhash module not available, skipping blurhash generation")
                relative_preview_path = os.path.join('docs', str(doc_id), preview_filename)
                return relative_preview_path, None
            
            # Generate blurhash
            blurhash_string = None
            try:
                with Image.open(full_preview_path) as img:
                    # Resize to smaller dimensions for blurhash calculation if needed
                    width, height = img.size
                    max_size = 100
                    if width > max_size or height > max_size:
                        img.thumbnail((max_size, max_size), Image.LANCZOS)
                    
                    # Create a copy of the image to prevent "Operation on closed image" errors
                    img_copy = img.copy()
                
                # Calculate blurhash (now using the copy outside the with block)
                try:
                    # Try different blurhash library APIs
                    try:
                        # blurhash library
                        blurhash_string = blurhash.encode(img_copy, 4, 3)
                        logger.info("Generated blurhash using blurhash library")
                    except TypeError:
                        # blurhash-python library
                        import numpy
                        blurhash_string = blurhash.encode(numpy.array(img_copy), 4, 3)
                        logger.info("Generated blurhash using blurhash-python library")
                except Exception as e:
                    logger.error(f"Error generating blurhash: {str(e)}", exc_info=True)
                    blurhash_string = None
                
                # Clean up the copy
                img_copy.close()
            except Exception as e:
                logger.error(f"Error in blurhash generation: {str(e)}", exc_info=True)
                blurhash_string = None
            
            # Return preview path relative to MEDIA_ROOT and blurhash
            relative_preview_path = os.path.join('docs', str(doc_id), preview_filename)
            logger.info(f"Returning: preview_path={relative_preview_path}, blurhash={blurhash_string is not None}")
            return relative_preview_path, blurhash_string
                
        except Exception as e:
            logger.error(f"Error generating preview for document {doc_id}: {str(e)}", exc_info=True)
            return None, None
    
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
