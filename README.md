# QnA PDF Pal Backend

## Setup

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --reload
   ```

- The backend will be available at http://localhost:8000
- Make sure to update the frontend API URLs to point to this backend.

## Features

- Library and PDF management
- PDF upload and chunking
- RAG-based QnA (Retrieval-Augmented Generation)
- Conversation history
- CORS enabled for frontend integration

## API Endpoints

- `/libraries` — Library CRUD
- `/libraries/{library_id}/documents` — PDF upload/list/delete
- `/libraries/{library_id}/chat` — QnA chat endpoint
- `/libraries/{library_id}/conversations` — Conversation history
