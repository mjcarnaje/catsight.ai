FROM python:3.11

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /usr/src/app

# Install common build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    libyaml-dev \
    libffi-dev \
    libssl-dev \
    curl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Upgrade pip and friends before installing packages
RUN pip install --upgrade pip setuptools wheel

# Install dependencies with binary preference
RUN pip install --prefer-binary -r requirements.txt

COPY . .

# Default command if none is provided in docker-compose
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
