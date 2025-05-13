FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    libyaml-dev \
    libffi-dev \
    libssl-dev \
    poppler-utils \
    curl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --user --upgrade pip setuptools wheel \
    && pip install --user -r requirements.txt \
    && pip install --user torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Final stage
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /usr/src/app

# Copy installed packages from builder stage
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install runtime dependencies including Chromium dependencies for Pyppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libyaml-0-2 \
    # PDF processing dependencies
    poppler-utils \
    # Chromium dependencies
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libxss1 \
    fonts-liberation \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/* \
 && which pdfinfo  # Verify pdfinfo is in PATH

# Copy application code
COPY . .

# Default command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
