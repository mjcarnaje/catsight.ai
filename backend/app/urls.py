from django.urls import path
from . import views

urlpatterns = [
    path('documents', views.index, name='index'),
    path('documents/upload', views.upload_doc, name='upload_doc'),
    path('documents/<int:doc_id>', views.get_doc, name='get_doc'),
    path('documents/<int:doc_id>/chunks', views.get_doc_chunks, name='get_doc_chunks'),
    path('documents/<int:doc_id>/original', views.get_doc_original_file, name='get_doc_original_file'),
    path('documents/<int:doc_id>/ocr', views.get_doc_ocr_file, name='get_doc_ocr_file'),
    path('documents/<int:doc_id>/delete', views.delete_doc, name='delete_doc'),
    path('documents/<int:doc_id>/update', views.update_doc, name='update_doc'),
    path('documents/search', views.search_docs, name='search_docs'),
    path('documents/chat', views.chat_with_docs, name='chat_with_docs'),
    path('documents/delete_all', views.delete_all_docs, name='delete_all_docs'),
    path('documents/generate_summary', views.generate_summary, name='generate_summary'),
]
