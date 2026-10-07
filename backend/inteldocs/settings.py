"""Django settings for CATSight.AI.

Everything that differs between a laptop and the hosted demo comes from the
environment (see .env.example at the repository root). Defaults are for local
development; production sets DJANGO_DEBUG=0 and a real DJANGO_SECRET_KEY.
"""

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

# Public origin of the app, e.g. https://catsight.mjcarnaje.com. Used for absolute
# URLs (avatars, OAuth redirect) and as the trusted CSRF origin.
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
ALLOWED_EMAIL_DOMAINS = env_list("ALLOWED_EMAIL_DOMAINS")

GOOGLE_OAUTH_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{PUBLIC_URL}/login")

# --- Public demo limits -------------------------------------------------------
# DEMO_MODE turns on one-click guest accounts and the per-user limits below.
# Admins are never limited. 0 disables an individual limit.
DEMO_MODE = env_bool("DEMO_MODE", False)
# Off: only admins can upload (the library is curated, e.g. with `manage.py ingest`);
# everyone else can still search and chat with what's there.
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
# LLM_PROVIDER picks where every model call goes:
#   openrouter - hosted models through OpenRouter (the public demo)
#   ollama     - fully local models through Ollama (opt-in, needs ./pull-llms.sh)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openrouter").strip().lower()
if LLM_PROVIDER not in {"openrouter", "ollama"}:
    raise ImproperlyConfigured(f"LLM_PROVIDER must be 'openrouter' or 'ollama', not {LLM_PROVIDER!r}")

_DEFAULT_MODELS = {
    # Verified against OpenRouter's model list on 2026-10-07. Gemini 3.1 Flash-Lite
    # reads scans well, calls tools and supports strict JSON schemas, at $0.25/$1.50
    # per million tokens. bge-m3 is the same multilingual embedder as the Ollama setup.
    "openrouter": {
        "CHAT_MODEL": "google/gemini-3.1-flash-lite",
        "FAST_MODEL": "google/gemini-3.1-flash-lite",
        "OCR_MODEL": "google/gemini-3.1-flash-lite",
        "EMBEDDING_MODEL": "baai/bge-m3",
    },
    "ollama": {
        # Pinned tag: the bare `qwen3:4b` alias points to the thinking-only release,
        # which reasons for minutes per reply on CPU.
        "CHAT_MODEL": "qwen3:4b-instruct-2507-q4_K_M",
        "FAST_MODEL": "qwen3:1.7b",
        "OCR_MODEL": "",  # local OCR uses marker/docling instead of a vision model
        "EMBEDDING_MODEL": "bge-m3",
    },
}[LLM_PROVIDER]

CHAT_MODEL = os.getenv("CHAT_MODEL") or _DEFAULT_MODELS["CHAT_MODEL"]  # answers + summaries
FAST_MODEL = os.getenv("FAST_MODEL") or _DEFAULT_MODELS["FAST_MODEL"]  # chat titles
OCR_MODEL = os.getenv("OCR_MODEL") or _DEFAULT_MODELS["OCR_MODEL"]  # page transcription
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL") or _DEFAULT_MODELS["EMBEDDING_MODEL"]
# Every stored vector has this many dimensions (bge-m3's native size). Changing the
# embedding model means re-indexing: `manage.py reindex --all`.
EMBEDDING_DIMENSIONS = env_int("EMBEDDING_DIMENSIONS", 1024)
# Vector-only matches below this cosine similarity are treated as unrelated. Measured
# with bge-m3: on-topic passages score ~0.55-0.75, off-topic ones ~0.30-0.40.
RETRIEVAL_MIN_SIMILARITY = float(os.getenv("RETRIEVAL_MIN_SIMILARITY", "0.42"))

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
# Context window requested from Ollama; its default (2-4k) silently truncates long prompts.
OLLAMA_NUM_CTX = env_int("OLLAMA_NUM_CTX", 8192)

# How PDFs become text: "vision" sends page images to OCR_MODEL (needs openrouter);
# "marker" / "docling" / "markitdown" run locally (needs the local-ocr image).
DEFAULT_TEXT_EXTRACTOR = os.getenv(
    "DEFAULT_TEXT_EXTRACTOR", "vision" if LLM_PROVIDER == "openrouter" else "marker"
)

# Optional reranking of hybrid search results with a cross-encoder through
# OpenRouter's /rerank endpoint (~$0.0002 per question). Empty disables it.
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "voyageai/rerank-2.5-lite" if LLM_PROVIDER == "openrouter" else "")

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
