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
    update_doc_markdown,
    search_docs,
    chat_with_docs,
    get_graph_image,
    get_chat_history,
    regenerate_preview,
    get_docs_count,
    regenerate_summary,
    reextract_doc,
    get_all_tags,
    get_all_years,
)
from .views.llm import (
    get_llm_models,
    get_llm_model,
)
from .views.chats import (
    get_recent_chats,
    get_chat,
    create_chat,
    delete_chat,
    get_chats_count,
)
from .views.tags import (
    get_tags,
    get_tag,
    create_tag,
    update_tag,
    delete_tag,
)

urlpatterns = [
    # Authentication URLs
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/google/', GoogleAuthView.as_view(), name='google_auth'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', UserProfileView.as_view(), name='profile'),

    # LLM URLs
    path('llm-models/', get_llm_models, name='get_llm_models'),
    path('llm-models/<int:pk>/', get_llm_model, name='get_llm_model'),
    
    # Document URLs
    path('documents/', get_docs, name='get_docs'),
    path('documents/count/', get_docs_count, name='get_docs_count'),
    path('documents/upload/', upload_doc, name='upload_doc'),
    path('documents/<int:doc_id>/', get_doc, name='get_doc'),
    path('documents/<int:doc_id>/raw/', get_doc_raw, name='get_doc_raw'),
    path('documents/<int:doc_id>/markdown/', get_doc_markdown, name='get_doc_markdown'),
    path('documents/<int:doc_id>/chunks/', get_doc_chunks, name='get_doc_chunks'),
    path('documents/<int:doc_id>/delete/', delete_doc, name='delete_doc'),
    path('documents/<int:doc_id>/update/', update_doc_markdown, name='update_doc_markdown'),
    path('documents/<int:doc_id>/regenerate-preview/', regenerate_preview, name='regenerate_preview'),
    path('documents/<int:doc_id>/regenerate-summary/', regenerate_summary, name='regenerate_summary'),
    path('documents/<int:doc_id>/reextract/', reextract_doc, name='reextract_doc'),
    path('documents/search/', search_docs, name='search_docs'),
    path('documents/chat/', chat_with_docs, name='chat_with_docs'),
    path('documents/graph/', get_graph_image, name='get_graph_image'),
    path('documents/get_all_tags/', get_all_tags, name='get_all_tags'),
    path('documents/get_all_years/', get_all_years, name='get_all_years'),
    
    # Chat URLs
    path('chats/count/', get_chats_count, name='get_chats_count'),
    path('chats/recent/', get_recent_chats, name='get_recent_chats'),
    path('chats/<int:chat_id>/', get_chat, name='get_chat'),
    path('chats/create/', create_chat, name='create_chat'),
    path('chats/<int:chat_id>/delete/', delete_chat, name='delete_chat'),
    path('chats/<str:chat_id>/history/', get_chat_history, name='get_chat_history'),
    
    # Tag URLs
    path('tags/', get_tags, name='get_tags'),
    path('tags/<int:tag_id>/', get_tag, name='get_tag'),
    path('tags/create/', create_tag, name='create_tag'),
    path('tags/<int:tag_id>/update/', update_tag, name='update_tag'),
    path('tags/<int:tag_id>/delete/', delete_tag, name='delete_tag'),
]
