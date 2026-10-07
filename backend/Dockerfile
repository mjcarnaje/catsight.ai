# CATSight.AI backend (Django API + Celery worker share this image).
#
#   docker build .                         slim image for LLM_PROVIDER=openrouter
#   docker build --build-arg LOCAL_OCR=1 . adds torch + marker/docling/markitdown (~3 GB)
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

ARG LOCAL_OCR=0
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
ARG DEV=0

COPY requirements*.txt ./
RUN python -m venv /venv && /venv/bin/pip install --upgrade pip setuptools wheel \
 && if [ "$LOCAL_OCR" = "1" ]; then \
      /venv/bin/pip install torch torchvision --index-url "$TORCH_INDEX_URL" \
      && /venv/bin/pip install -r requirements-local-ocr.txt; \
    fi \
 && /venv/bin/pip install -r requirements.txt \
 && if [ "$DEV" = "1" ]; then /venv/bin/pip install -r requirements-dev.txt; fi


FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH=/venv/bin:$PATH
WORKDIR /usr/src/app

ARG LOCAL_OCR=0
# OpenCV (used by marker/surya) needs libGL and glib at import time
RUN if [ "$LOCAL_OCR" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
      && rm -rf /var/lib/apt/lists/*; \
    fi \
 && useradd --create-home --uid 1000 app

COPY --from=builder /venv /venv
COPY --chown=app:app . .
RUN mkdir -p media static .cache && chown -R app:app media static .cache

USER app
EXPOSE 8000
CMD ["gunicorn", "inteldocs.wsgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "gthread", "--workers", "2", "--threads", "8", "--timeout", "180"]
