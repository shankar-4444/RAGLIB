from app.rag.embedder import embed_texts
from app.rag.vector_store import vector_store
from sqlalchemy.orm import Session
from app.db import models
from typing import List, Dict

def estimate_token_count(text: str) -> int:
    # Simple token estimator: 1 token ≈ 4 characters (for English)
    return max(1, len(text) // 4)

def calculate_chunk_relevance_score(chunk_content: str, question: str) -> float:
    """Calculate a relevance score for a chunk based on question overlap."""
    question_words = set(question.lower().split())
    chunk_words = set(chunk_content.lower().split())
    
    # Calculate word overlap
    overlap = len(question_words.intersection(chunk_words))
    total_question_words = len(question_words)
    
    if total_question_words == 0:
        return 0.0
    
    # Base score from word overlap
    overlap_score = overlap / total_question_words
    
    # Bonus for exact phrase matches
    phrase_bonus = 0.0
    for word in question_words:
        if len(word) > 3 and word in chunk_content.lower():
            phrase_bonus += 0.1
    
    # Penalty for very short chunks
    length_penalty = 0.0
    if len(chunk_content) < 50:
        length_penalty = 0.2
    
    return max(0.0, overlap_score + phrase_bonus - length_penalty)

def retrieve_relevant_chunks(
    question: str,
    library_id: str,
    db: Session,
    batch_size: int = 20,
    min_relevant: int = 5,
    max_batches: int = 25,
    metadata_filter: dict = None,
    document_ids: List[str] = None,
    response_length: str = "medium",  # "short", "medium", "long"
) -> List[Dict]:
    q_emb = embed_texts([question])[0]
    retrieved = set()
    relevant_chunks = []
    
    # Adjust target chunks based on response length preference
    if response_length == "short":
        target_chunks = min_relevant * 2
        min_relevant = 3
    elif response_length == "long":
        target_chunks = min_relevant * 4
        min_relevant = 8
    else:  # medium
        target_chunks = min_relevant * 3
        min_relevant = 5
    
    for batch in range(1, max_batches + 1):
        k = batch * batch_size
        results = vector_store.search_embeddings(q_emb, top_k=k)
        print(f"[DEBUG] Batch {batch}: Retrieved {len(results)} chunks from vector store for question '{question}'")
        filtered = 0
        for lib_id, doc_id, chunk_id, page_number, chunk_index in results:
            if lib_id != library_id:
                filtered += 1
                continue
            if chunk_id in retrieved:
                continue
            retrieved.add(chunk_id)
            chunk = db.query(models.DocumentChunk).filter(models.DocumentChunk.id == chunk_id).first()
            doc = db.query(models.PDFDocument).filter(models.PDFDocument.id == doc_id).first()
            if chunk and doc:
                # Document ID filter
                if document_ids and document_ids:
                    if doc.id not in document_ids:
                        continue
                
                # Metadata filter
                if metadata_filter:
                    meta = chunk.chunk_metadata or {}
                    if not all(meta.get(k) == v for k, v in metadata_filter.items()):
                        continue
                # Calculate relevance score
                relevance_score = calculate_chunk_relevance_score(chunk.content, question)
                
                relevant_chunks.append({
                    "content": chunk.content,
                    "document_name": doc.name,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                    "metadata": chunk.chunk_metadata,
                    "relevance_score": relevance_score
                })
                if len(relevant_chunks) <= 3:
                    print(f"[DEBUG] Relevant chunk from {doc.name}: {chunk.content[:200]}")
            if len(relevant_chunks) >= target_chunks:
                print(f"[DEBUG] Found {len(relevant_chunks)} relevant chunks, stopping retrieval.")
                break
        print(f"[DEBUG] Filtered out {filtered} chunks by library_id in batch {batch}.")
        if len(relevant_chunks) >= target_chunks:
            break
        if len(relevant_chunks) == 0 and batch > 1:
            print(f"[DEBUG] No relevant chunks found after {batch} batches.")
            break
    
    # Diversify chunks by document to ensure multiple documents are represented
    diversified_chunks = diversify_chunks_by_document(relevant_chunks, min_relevant)
    print(f"[DEBUG] Diversified from {len(relevant_chunks)} to {len(diversified_chunks)} chunks from {len(set(c['document_name'] for c in diversified_chunks))} documents")
    return diversified_chunks

def diversify_chunks_by_document(chunks: List[Dict], target_count: int) -> List[Dict]:
    """Diversify chunks to ensure representation from multiple documents with relevance scoring."""
    if not chunks:
        return []
    
    # Sort chunks by relevance score first
    chunks.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
    
    # Group chunks by document
    doc_groups = {}
    for chunk in chunks:
        doc_name = chunk['document_name']
        if doc_name not in doc_groups:
            doc_groups[doc_name] = []
        doc_groups[doc_name].append(chunk)
    
    # Sort documents by average relevance score
    doc_scores = {}
    for doc_name, doc_chunks in doc_groups.items():
        avg_score = sum(c.get('relevance_score', 0) for c in doc_chunks) / len(doc_chunks)
        doc_scores[doc_name] = avg_score
    
    sorted_docs = sorted(doc_groups.items(), key=lambda x: doc_scores[x[0]], reverse=True)
    
    diversified = []
    
    # Take the best chunk from each document in order of relevance
    for doc_name, doc_chunks in sorted_docs:
        if doc_chunks and len(diversified) < target_count:
            # Take the best chunk from this document
            diversified.append(doc_chunks.pop(0))
    
    # If we still need more chunks, take the remaining best chunks
    remaining_chunks = []
    for doc_name, doc_chunks in sorted_docs:
        remaining_chunks.extend(doc_chunks)
    
    # Sort remaining chunks by relevance and add them
    remaining_chunks.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
    diversified.extend(remaining_chunks[:target_count - len(diversified)])
    
    return diversified[:target_count]
