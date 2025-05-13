# 📚 CATSight.AI Documentation

> AI-powered document analysis and retrieval for Mindanao State University - Iligan Institute of Technology.

## 📋 Table of Contents

- [Introduction](#introduction)
- [System Architecture](#system-architecture)
  - [Authentication & Authorization](#authentication--authorization)
  - [Retrieval-Augmented Generation (RAG) Pipeline](#retrieval-augmented-generation-rag-pipeline)
  - [Tech Stack](#tech-stack)
  - [Available Models](#available-models)
- [Features](#features)
  - [Semantic Search](#semantic-search)
  - [Conversational AI](#conversational-ai)
  - [Document Management](#document-management)
  - [User Features](#user-features)
- [Future Enhancements](#future-enhancements)
- [Setup & Operations](#setup--operations)
  - [Database Configuration](#database-configuration)
  - [Docker Commands](#docker-commands)
  - [Model Management](#model-management)

## Introduction

CATSight.AI is a platform for AI-powered document analysis and retrieval designed specifically for Mindanao State University - Iligan Institute of Technology. The system allows users to upload, search, and have conversations with documents using advanced AI models.

## System Architecture

### Authentication & Authorization

CATSight.AI supports two authentication methods:

1. **Google OAuth**
2. **Email/Password**

> 🔒 **Note**: Only users with `@g.msuiit.edu.ph` email addresses are allowed access to the platform.

#### Role-Based Access Control (RBAC)

We enforce RBAC with three predefined roles:

- **SuperAdmin**

  - Full system access
  - Can manage all users, roles, documents, and system-level settings

- **Admin**

  - Can upload, manage, and organize documents
  - Cannot manage users

- **User**
  - Can search, view, and chat with documents
  - Cannot upload or manage documents

### Retrieval-Augmented Generation (RAG) Pipeline

Here's how the system processes and retrieves document data:

1. **Upload Document**

   - Users upload PDF files through the UI
   - Files are saved to **local storage** (with support for S3 or GCS as future enhancements)

2. **Convert PDF to Markdown**

   - The uploaded PDF is converted to Markdown using either:
     - [`Marker`](https://github.com/paperswithcode/marker) (default)
     - [`MarkitDown`](https://github.com/ContextualAI/markitdown) as an alternative
     - [`Docling`](https://github.com/docling/docling) as another alternative
   - OCR fallback is applied if the document is scanned/non-selectable

3. **Chunking**

   - The Markdown text is split into dynamic chunks using:
     - **LangChain's RecursiveCharacterTextSplitter**
     - Configured with overlap to preserve context across chunks

4. **Embedding**

   - Chunks are embedded using **bge-m3** model
   - Batched embedding for performance optimization

5. **Vector Storage**
   - Embeddings are stored in **PostgreSQL** using the **pgvector** extension
   - Each chunk includes:
     - Chunk metadata (e.g., page number, section title)
     - Original document reference

### Tech Stack

| Component       | Technology                                 |
| --------------- | ------------------------------------------ |
| PDF to Markdown | Marker / MarkitDown / Docling              |
| Chunking        | LangChain (RecursiveCharacterTextSplitter) |
| Embedding Model | bge-m3                                     |
| Vector Store    | PostgreSQL + pgvector                      |
| LLM             | Llama, DeepSeek R1, Qwen2.5-Coder          |
| Search & Chat   | Semantic Retrieval + Context-aware LLM     |
| Backend         | Python (Django)                            |
| Task Queue      | Celery                                     |
| Authentication  | Google OAuth, Email/Password               |
| File Storage    | Local (can be extended to cloud)           |

### Available Models

**Embedding Models:**

- **bge-m3**
  - Model: `bge-m3`

**Large Language Models (LLMs):**

- **Llama 3.2:1b**
  - Model: `llama3.2:1b`
- **DeepSeek R1 1.5B**
  - Model: `deepseek-r1:1.5b`

## Features

### Semantic Search

Users can perform **content-based search** across the document collection:

1. **Query Embedding**: User query is embedded using `bge-m3`
2. **Vector Similarity Search**: Top-k relevant chunks are retrieved using cosine similarity
3. **Re-ranking**: (Optional) Chunks can be re-ranked using LLM for better contextual relevance
4. **Result Display**: Top results are presented to the user with highlights and source attribution

### Conversational AI

The platform supports chat interactions with documents via a **Llama 3.2-powered** chatbot.

**Chat Flow:**

1. User sends a message
2. Message is embedded using `bge-m3`
3. Top relevant chunks are retrieved using semantic search
4. Context is passed to **Llama 3.2** for response generation
5. Response is returned along with:
   - Source documents
   - Contextual references
   - Chat history

### Document Management

**Admin/SuperAdmin Only Features:**

- Upload, edit, view, and delete documents
- Download document files
- Auto-tagging and categorization (planned)
- Optional: Document versioning and audit trail (recommended enhancement)

### User Features

Every user has access to:

- **Profile Management**
  - Edit name, avatar, and email (non-editable if using Google OAuth)
- **Document Interaction**
  - Chat with all documents or a specific one
  - Access to full or filtered chat history
- **Search Interface**
  - Perform natural language search across all documents
  - View search history and re-execute past searches

## Future Enhancements

To make the platform more robust and enterprise-ready, consider adding:

- **Feedback Loop for LLM Quality**: Users can rate chatbot responses to improve future accuracy
- **Document Tagging / Metadata Extraction**: Auto-classify documents using NER or ML classifiers
- **Multi-modal Support**: Add support for image-heavy documents or videos (e.g., using BLIP or CLIP)
- **Realtime Collaboration**: Allow multiple users to comment/discuss within the same document
- **Audit Logging**: Track user actions for security and compliance
- **Multi-Tenant Support**: Organizations can have isolated document spaces and user bases
- **Document Expiry/Archival**: Set expiration or archive rules for old or unused documents

## Setup & Operations

### Database Configuration

To enable vector search, you need to create the vector extension on your PostgreSQL database:

```bash
docker compose exec db psql -U postgres -d app_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Make migrations for the vector extension:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

### Docker Commands

**Running Commands in Containers:**

```bash
# Backend container
docker compose exec backend <command>

# Ollama container
docker compose exec ollama <command>

# Frontend container
docker compose exec frontend <command>

# Database container
docker compose exec db psql -U <username> -d <database> -c <command>
```

**Building and Managing Services:**

```bash
# Build specific services
docker compose build <service>

# Restart services
docker compose down
docker compose up -d

# Create a superuser
docker compose exec backend python manage.py createsuperuser --username <username> --email <email>

# Remove all containers
docker compose down -v

# Prune all containers
docker system prune -a -f

# Build and start all services
docker compose up -d --build
```

### Model Management

**Pull Default Models:**

```bash
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama pull qwen3:1.7b
docker compose exec ollama ollama pull bge-m3
docker compose exec ollama ollama pull phi4
```

**To get the list of models available in the ollama container:**

```bash
docker compose exec ollama ollama list
```

**Downloading Models for Offline Use:**

For air-gapped environments, you can prefetch Docling models:

```bash
docker compose exec backend docling-tools models download
```

```bash
docker compose exec backend python manage.py makemigrations app --empty --name remove_deepseek_model
```

```bash
docker compose exec backend python manage.py migrate
```

To clean the database, run:

```bash
docker compose exec backend python manage.py flush --noinput
```
