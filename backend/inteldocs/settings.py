"""Django settings for CATSight.AI.

Everything that differs between a laptop and the hosted demo comes from the
environment (see .env.example at the repository root). Defaults are for local
development; production sets DJANGO_DEBUG=0 and a real DJANGO_SECRET_KEY.
"""

import importlib.util
import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value not in (None, "") else default


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# --- Core ---------------------------------------------------------------------
DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Set DJANGO_SECRET_KEY (or DJANGO_DEBUG=1 for local development).")
    SECRET_KEY = "dev-only-insecure-key-never-use-in-production"

# Encrypts organizations' API keys at rest (Fernet: 32 url-safe base64-encoded bytes).
# Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Changing it makes the stored keys unreadable: admins then have to enter them again.
FIELD_ENCRYPTION_KEY = os.getenv("FIELD_ENCRYPTION_KEY", "")
if not FIELD_ENCRYPTION_KEY and not DEBUG:
    raise ImproperlyConfigured("Set FIELD_ENCRYPTION_KEY (or DJANGO_DEBUG=1 for local development).")

# Public origin of the app, e.g. https://catsight.mjcarnaje.com. Used for absolute
# URLs (Open Graph tags, attribution headers) and as the trusted CSRF origin.
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:3000").rstrip("/")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,backend")
CSRF_TRUSTED_ORIGINS = [PUBLIC_URL]

# The SPA is served from the same origin as the API (Vite proxy in development,
# nginx in production), so cross-origin requests are opt-in only.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")

# Behind Cloudflare Tunnel -> nginx, the original scheme arrives in X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "app",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

if not DEBUG:
    # Serves the Django admin's static files under gunicorn (runserver does it in development)
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

ROOT_URLCONF = "inteldocs.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "inteldocs.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "app_db"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        # Reuse connections between requests; SSE streams hold theirs for the answer
        "CONN_MAX_AGE": env_int("POSTGRES_CONN_MAX_AGE", 60),
    }
}

AUTH_USER_MODEL = "app.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# --- Accounts -----------------------------------------------------------------
# Comma-separated email domains allowed to register; empty allows any domain.
# An invitation lets its recipient register with any address.
ALLOWED_EMAIL_DOMAINS = env_list("ALLOWED_EMAIL_DOMAINS")
INVITATION_TTL_DAYS = env_int("INVITATION_TTL_DAYS", 7)

# --- Email (invitations) ------------------------------------------------------
# With EMAIL_HOST set, mail goes out over SMTP; without it, development prints it
# to the console. Admins can always copy an invitation's link instead.
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = env_int("EMAIL_PORT", 587)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = 15
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "CATSight <no-reply@localhost>")


# --- Public demo limits -------------------------------------------------------
# DEMO_MODE turns on one-click guest accounts and the per-user limits below. Guests
# join the organization DEMO_ORG (its slug), and the limits apply to its non-admin
# members only: every other organization pays with its own key and isn't limited.
# 0 disables an individual limit.
DEMO_MODE = env_bool("DEMO_MODE", False)
DEMO_ORG = os.getenv("DEMO_ORG", "demo")
# Off: only organization admins can upload (the library is curated, e.g. with
# `manage.py ingest`); everyone else can still search and chat with what's there.
UPLOADS_ENABLED = env_bool("UPLOADS_ENABLED", True)
GUEST_ACCESS = env_bool("GUEST_ACCESS", DEMO_MODE)
GUEST_TTL_HOURS = env_int("GUEST_TTL_HOURS", 24)  # guests and their uploads are removed after this
DEMO_DAILY_UPLOADS = env_int("DEMO_DAILY_UPLOADS", 3)  # documents per user per day
DEMO_DAILY_MESSAGES = env_int("DEMO_DAILY_MESSAGES", 25)  # chat questions per user per day
DEMO_LIBRARY_PAGE_LIMIT = env_int("DEMO_LIBRARY_PAGE_LIMIT", 600)  # all pages ever OCR'd, across users
DEMO_MAX_UPLOAD_MB = env_int("DEMO_MAX_UPLOAD_MB", 10)  # per file, for visitors
DEMO_MAX_UPLOAD_PAGES = env_int("DEMO_MAX_UPLOAD_PAGES", 15)
MAX_UPLOAD_MB = env_int("MAX_UPLOAD_MB", 30)  # per file, for everyone else
MAX_UPLOAD_PAGES = env_int("MAX_UPLOAD_PAGES", 100)

DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # larger uploads stream to a temp file
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# --- Models -------------------------------------------------------------------
# Each organization picks its provider and pastes its own key (Settings → AI provider):
#   openrouter - hosted models through OpenRouter
#   openai     - OpenAI's API
#   ollama     - this server's Ollama (no key; the super admin enables it per organization)
# A model left blank in an organization's settings uses these defaults.
PROVIDER_DEFAULTS = {
    # Open-weight models through OpenRouter (verified against its model list on
    # 2026-10-07), so the same weights can run on an institution's own GPUs.
    # Qwen3-VL-30B-A3B-Instruct (Apache-2.0) reads page images, calls tools and
    # supports strict JSON schemas; BGE-M3 (MIT) is the same multilingual embedder
    # as the Ollama setup; Qwen3-Reranker-8B (Apache-2.0) reorders search results.
    "openrouter": {
        "chat_model": "qwen/qwen3-vl-30b-a3b-instruct",
        "fast_model": "qwen/qwen3-vl-30b-a3b-instruct",
        "ocr_model": "qwen/qwen3-vl-30b-a3b-instruct",
        "embedding_model": "baai/bge-m3",
        "reranker_model": "qwen/qwen3-reranker-8b",
    },
    # gpt-4.1-mini reads images, calls tools, follows strict JSON schemas and accepts a
    # temperature; text-embedding-3 models shorten their vectors to EMBEDDING_DIMENSIONS.
    # OpenAI has no rerank endpoint, so results keep their fused order.
    "openai": {
        "chat_model": "gpt-4.1-mini",
        "fast_model": "gpt-4.1-mini",
        "ocr_model": "gpt-4.1-mini",
        "embedding_model": "text-embedding-3-small",
        "reranker_model": "",
    },
    "ollama": {
        # Pinned tag: the bare `qwen3:4b` alias points to the thinking-only release,
        # which reasons for minutes per reply on CPU.
        "chat_model": "qwen3:4b-instruct-2507-q4_K_M",
        "fast_model": "qwen3:1.7b",
        # Optional local vision model for marker's LLM mode (e.g. "qwen3-vl:8b"); empty = off
        "ocr_model": "",
        "embedding_model": "bge-m3",
        "reranker_model": "",
    },
}

# Every stored vector has this many dimensions (bge-m3's native size; OpenAI's
# text-embedding-3 models are asked for it). An organization can only choose an
# embedding model that returns this many values.
EMBEDDING_DIMENSIONS = env_int("EMBEDDING_DIMENSIONS", 1024)
# Vector-only matches below this cosine similarity are treated as unrelated. Measured
# with bge-m3: on-topic passages score ~0.55-0.75, off-topic ones ~0.30-0.40.
RETRIEVAL_MIN_SIMILARITY = float(os.getenv("RETRIEVAL_MIN_SIMILARITY", "0.42"))

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
# Context window requested from Ollama; its default (2-4k) silently truncates long prompts.
OLLAMA_NUM_CTX = env_int("OLLAMA_NUM_CTX", 8192)

# How PDFs become text: "marker" (Marker 2 with Surya OCR 2; the default wherever the
# local-ocr image installed it), "vision" (page images to the organization's OCR model,
# OpenRouter or OpenAI), or "docling" / "markitdown" (local-ocr image). An organization
# whose provider can't run the default gets the first extractor it can run.
DEFAULT_TEXT_EXTRACTOR = os.getenv(
    "DEFAULT_TEXT_EXTRACTOR", "marker" if importlib.util.find_spec("marker") else "vision"
)
# Marker's LLM mode: tables, forms and handwriting are refined by the organization's OCR model
MARKER_USE_LLM = env_bool("MARKER_USE_LLM", True)

# --- i18n / static / media ----------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Manila")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "static"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Shared cache (rate limiting); Redis is already running for Celery.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("CACHE_URL", "redis://redis:6379/1"),
    }
}

# --- Celery -------------------------------------------------------------------
CELERY_BROKER_URL = os.getenv("CELERY_BROKER", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_BACKEND", "redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
# A worker crash mid-document puts the task back on the queue instead of losing it
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
# How long Redis waits before redelivering a task a dead worker had taken. Must be
# longer than the slowest document (a 100-page PDF takes a few minutes).
CELERY_BROKER_TRANSPORT_OPTIONS = {"visibility_timeout": 30 * 60}

# --- Logging ------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "app": {"handlers": ["console"], "level": os.getenv("APP_LOG_LEVEL", "INFO"), "propagate": False},
        "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "httpx": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
