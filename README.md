# SmartDocument

The SmartDocument Backend is a robust system designed to process, analyze, and enable interactive searching and chatting with documents, including scanned PDFs and non-searchable text files.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [How It Works](#how-it-works)
- [Use Case](#use-case)

## Features

- **Content-Based Search**: Search through the actual content of documents, not just titles or keywords.
- **OCR Processing**: Automatically extract text from scanned PDFs using Optical Character Recognition (OCR).
- **Vector Embeddings with FAISS**: Utilize Llama Embeddings and FAISS for efficient vector storage and retrieval.
- **Interactive Chat Interface**: Engage with the document collection using a chat interface powered by Llama LLM, similar to ChatGPT.

## Prerequisites

- Python 3.8 or higher
- Redis
- Ollama
- FAISS (CPU or GPU support)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mjcarnaje/smartdocument.git
cd smartdocument
```

### 2. Install Python Dependencies

Ensure you have Python 3.8+ installed. Then, install the required Python packages:

```bash
pip install -r requirements.txt
```

### 3. Install Redis

- **Ubuntu/Debian**:

  ```bash
  sudo apt-get install redis-server
  ```

- **macOS**:

  ```bash
  brew install redis
  ```

- **Windows**:

  Download and install from [Redis Downloads](https://redis.io/download).

### 4. Install Ollama

Follow the instructions on the [Ollama GitHub page](https://github.com/ollama/ollama) to install Ollama for your operating system.

### 5. Pull the Llama 3.2 Model

```bash
ollama pull llama2:3.2
```

### 6. Install FAISS

- **CPU-only support**:

  ```bash
  pip install faiss-cpu
  ```

- **GPU support**:

  ```bash
  pip install faiss-gpu
  ```

### 7. Set Up Environment Variables

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit the `.env` file to configure your environment variables (e.g., database settings, API keys).

## Configuration

Ensure that all services (Redis, Ollama) are running and properly configured. Update the settings in your Django `settings.py` and `.env` files as needed.

## Running the Application

### Start Redis Server

```bash
redis-server
```

### Apply Database Migrations

```bash
python manage.py migrate
```

### Run the Django Development Server

```bash
python manage.py runserver
```

### Start Background Workers

If using Celery for background tasks:

```bash
celery -A smartdocument_backend worker --loglevel=info
```

## How It Works

1. **File Upload**: Users upload documents through the application interface.
2. **OCR Processing**: If a file is a scanned PDF or contains non-searchable text, the system automatically performs OCR to extract the content.
3. **Content Chunking**: The extracted text is divided into manageable chunks.
4. **Vectorization**: Each text chunk is converted into a vector using Llama Embeddings.
5. **Storage with FAISS**: Vector representations are stored using FAISS for efficient similarity search.
6. **Search Functionality**: Users can perform content-based searches, retrieving documents related to their query.
7. **Interactive Chat**: Users can interact with the document corpus through a chat interface powered by Llama LLM, enabling conversational queries and responses.

## Use Case

The system is ideal for environments with extensive document collections requiring efficient search and interaction capabilities. For example, a professor can:

- Upload all academic materials, including scanned documents.
- Search for specific events like "Palakasan 2023" and retrieve all related documents based on content.
- Engage in a conversational interface to ask follow-up questions or seek clarifications, much like interacting with ChatGPT.
