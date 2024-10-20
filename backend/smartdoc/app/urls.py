from django.urls import path
from . import views

urlpatterns = [
    path('documents', views.index, name='index'),
    path('documents/upload', views.upload_doc, name='upload_doc'),
    path('documents/<int:doc_id>', views.get_doc, name='get_doc'),
    path('documents/<int:doc_id>/original', views.get_doc_original_file, name='get_doc_original_file'),
    path('documents/<int:doc_id>/ocr', views.get_doc_ocr_file, name='get_doc_ocr_file'),
    path('documents/<int:doc_id>/delete', views.delete_doc, name='delete_doc'),
    path('documents/<int:doc_id>/update', views.update_doc, name='update_doc'),
]
