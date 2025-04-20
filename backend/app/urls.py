from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views.auth import (
    RegisterView,
    LoginView, 
    GoogleAuthView,
    UserProfileView,
)
from .views.documents import (
    get_docs,
    upload_doc,
    get_doc,
    get_doc_raw,
    get_doc_markdown,
    get_doc_chunks,
    delete_doc,
    update_doc,
    search_docs,
    chat_with_docs,
    delete_all_docs,
    retry_doc_processing,
    chat_with_single_doc
)

urlpatterns = [
    # Authentication URLs
    path('auth/register', RegisterView.as_view(), name='register'),
    path('auth/login', LoginView.as_view(), name='login'),
    path('auth/google', GoogleAuthView.as_view(), name='google_auth'),
    path('auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile', UserProfileView.as_view(), name='profile'),
    
    # Document URLs
    path('documents', get_docs, name='get_docs'),
    path('documents/upload', upload_doc, name='upload_doc'),
    path('documents/<int:doc_id>', get_doc, name='get_doc'),
    path('documents/<int:doc_id>/raw', get_doc_raw, name='get_doc_raw'),
    path('documents/<int:doc_id>/markdown', get_doc_markdown, name='get_doc_markdown'),
    path('documents/<int:doc_id>/chunks', get_doc_chunks, name='get_doc_chunks'),
    path('documents/<int:doc_id>/delete', delete_doc, name='delete_doc'),
    path('documents/<int:doc_id>/update', update_doc, name='update_doc'),
    path('documents/search', search_docs, name='search_docs'),
    path('documents/chat', chat_with_docs, name='chat_with_docs'),
    path('documents/delete_all', delete_all_docs, name='delete_all_docs'),
    path('documents/<str:doc_id>/retry/', retry_doc_processing, name='retry_doc_processing'),
    path('documents/<str:doc_id>/chat', chat_with_single_doc, name='chat_with_single_doc'),
]
