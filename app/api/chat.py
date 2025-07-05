from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.schemas.chat import ChatRequest, ChatResponse
from uuid import uuid4
from app.rag.retrieval import retrieve_relevant_chunks, estimate_token_count
import os
import httpx
from app.config import OPENAI_API_KEY, OPENAI_MODEL, SYSTEM_PROMPT, OPENAI_API_BASE

router = APIRouter()

def get_chat_endpoint():
    if "nvidia" in OPENAI_API_BASE:
        return f"{OPENAI_API_BASE}"
    return f"{OPENAI_API_BASE}"

async def call_llm(messages, max_tokens=1000):
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    body = {
        "model": OPENAI_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
        "stream": False
    }
    url = get_chat_endpoint()
    print(f"[DEBUG] Calling LLM at: {url}")
    print(f"[DEBUG] Using model: {OPENAI_MODEL}")
    print(f"[DEBUG] API key present: {bool(OPENAI_API_KEY)}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=headers, json=body, timeout=30.0)
            print(f"[DEBUG] LLM response status: {resp.status_code}")
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException:
            raise Exception("LLM service timeout - request took too long")
        except httpx.HTTPStatusError as e:
            raise Exception(f"LLM service HTTP error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise Exception(f"LLM service error: {str(e)}")

@router.post("/{library_id}/chat", response_model=ChatResponse)
async def chat_with_library(library_id: str, req: ChatRequest = Body(...), db: Session = Depends(get_db)):
    # Retrieve relevant chunks with response length control
    metadata_filter = getattr(req, 'metadata_filter', None)
    document_ids = getattr(req, 'document_ids', None)
    response_length = getattr(req, 'response_length', 'medium')
    chunks = retrieve_relevant_chunks(
        req.question, 
        library_id, 
        db, 
        batch_size=20, 
        min_relevant=5, 
        max_batches=25, 
        metadata_filter=metadata_filter, 
        document_ids=document_ids,
        response_length=response_length
    )
    if not chunks:
        return ChatResponse(
            answer="Sorry, this question is outside the scope of the selected library.",
            sources=[],
            conversation_id=req.conversation_id or str(uuid4())
        )
    # Diversify context: prefer one chunk per unique toc_title (chapter/section)
    seen_titles = set()
    diversified_chunks = []
    extra_chunks = []
    for c in chunks:
        toc_title = (c.get('metadata') or {}).get('toc_title')
        if toc_title and toc_title not in seen_titles:
            diversified_chunks.append(c)
            seen_titles.add(toc_title)
        else:
            extra_chunks.append(c)
    # Fill up to min_relevant with extra chunks if needed
    diversified_chunks += extra_chunks[:max(0, 5 - len(diversified_chunks))]
    # Build enhanced context with better structure
    MAX_TOKENS = 3500
    context_chunks = []
    total_tokens = 0
    
    # Group chunks by document for better organization
    doc_groups = {}
    for c in diversified_chunks:
        doc_name = c['document_name']
        if doc_name not in doc_groups:
            doc_groups[doc_name] = []
        doc_groups[doc_name].append(c)
    
    for doc_name, doc_chunks in doc_groups.items():
        doc_context = f"=== DOCUMENT: {doc_name} ===\n"
        for c in doc_chunks:
            section_info = f"Section: {(c.get('metadata') or {}).get('toc_title', 'Unknown')}"
            chunk_text = f"[Page {c['page_number']}, {section_info}]\n{c['content']}"
            chunk_tokens = estimate_token_count(chunk_text)
            if total_tokens + chunk_tokens > MAX_TOKENS:
                break
            doc_context += chunk_text + "\n\n"
            total_tokens += chunk_tokens
        context_chunks.append(doc_context)
        if total_tokens >= MAX_TOKENS:
            break
    
    context = "\n".join(context_chunks)
    print(f"[DEBUG] Context sent to LLM (first 1000 chars):\n{context[:1000]}")
    
    # Enhanced prompt engineering based on response length
    if response_length == "short":
        system_prompt = f"{SYSTEM_PROMPT}\n\nProvide a concise answer (2-3 sentences maximum). Focus on the most relevant information only."
        max_tokens = 500
    elif response_length == "long":
        system_prompt = f"{SYSTEM_PROMPT}\n\nProvide a comprehensive answer with detailed explanations and examples from the documents. Include relevant context and connections between different parts of the documents."
        max_tokens = 2000
    else:  # medium
        system_prompt = f"{SYSTEM_PROMPT}\n\nProvide a balanced answer with sufficient detail to fully address the question while remaining focused and clear."
        max_tokens = 1000
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Based on the following context from the documents, please answer the question. If the answer is not in the context, please say so.\n\nContext:\n{context}\n\nQuestion: {req.question}"}
    ]
    try:
        answer = await call_llm(messages, max_tokens)
    except Exception as e:
        print(f"[ERROR] LLM service error: {e}")
        answer = f"I'm having trouble connecting to the AI service. Error: {str(e)}"
    sources = [f"{c['document_name']} (Page {c['page_number']})" for c in chunks]
    return ChatResponse(answer=answer, sources=list(set(sources)), conversation_id=req.conversation_id or str(uuid4()))

@router.post("/{library_id}/debug_retrieve", response_model=list)
def debug_retrieve_chunks(library_id: str, req: ChatRequest = Body(...), db: Session = Depends(get_db), n: int = 10):
    """Debug endpoint: returns the top N retrieved chunks for a question."""
    metadata_filter = getattr(req, 'metadata_filter', None)
    document_ids = getattr(req, 'document_ids', None)
    chunks = retrieve_relevant_chunks(req.question, library_id, db, batch_size=n, min_relevant=n, max_batches=1, metadata_filter=metadata_filter, document_ids=document_ids)
    return [
        {
            "document_name": c["document_name"],
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
            "content": c["content"][:500],  # Truncate for readability
            "metadata": c["metadata"]
        }
        for c in chunks
    ]
