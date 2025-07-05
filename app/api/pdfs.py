from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db import models
from app.schemas.pdf import PDFDocumentSchema
from typing import List
from datetime import datetime
import os
import tempfile
from app.rag.pdf_parser import parse_pdf_and_chunk, extract_toc_from_pdf
from app.rag.embedder import embed_texts
from app.rag.vector_store import vector_store
import PyPDF2

router = APIRouter()

MAX_PDF_SIZE_MB = 20

@router.get("/{library_id}/documents", response_model=List[PDFDocumentSchema])
def list_documents(library_id: str, db: Session = Depends(get_db)):
    # Use a more direct approach to avoid session issues
    from sqlalchemy import text
    
    # Get documents with chunks in a single query
    query = text("""
        SELECT 
            d.id, d.name, d.upload_date, d.library_id, d.toc, d.tags,
            c.id as chunk_id, c.content, c.page_number, c.chunk_index
        FROM pdf_documents d
        LEFT JOIN document_chunks c ON d.id = c.document_id
        WHERE d.library_id = :library_id
        ORDER BY d.upload_date DESC, c.page_number, c.chunk_index
    """)
    
    result = db.execute(query, {"library_id": library_id})
    
    # Group by document
    documents = {}
    for row in result:
        doc_id = row.id
        if doc_id not in documents:
            documents[doc_id] = {
                "id": doc_id,
                "name": row.name,
                "upload_date": row.upload_date,
                "library_id": row.library_id,
                "toc": row.toc,
                "tags": row.tags,
                "chunks": []
            }
        
        if row.chunk_id:  # Only add chunk if it exists
            documents[doc_id]["chunks"].append({
                "id": row.chunk_id,
                "content": row.content,
                "page_number": row.page_number,
                "chunk_index": row.chunk_index
            })
    
    return list(documents.values())

@router.post("/{library_id}/documents", response_model=PDFDocumentSchema)
def upload_document(library_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Validate file type
    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    # Validate file size
    file.file.seek(0, os.SEEK_END)
    size_mb = file.file.tell() / (1024 * 1024)
    file.file.seek(0)
    if size_mb > MAX_PDF_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"PDF file too large (>{MAX_PDF_SIZE_MB}MB).")
    tmp_path = None
    try:
        # Save file to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        # Extract ToC
        toc = extract_toc_from_pdf(tmp_path)
        print(f"[DEBUG] Extracted ToC: {toc}")
        # Parse and chunk using ToC and heading detection
        chunks = parse_pdf_and_chunk(tmp_path, toc)
        print(f"[DEBUG] Parsed {len(chunks)} chunks from PDF '{file.filename}'")
        for i, c in enumerate(chunks[:3]):
            print(f"[DEBUG] Chunk {i}: {c}")
        if not chunks:
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
        chunk_texts = [c[0] for c in chunks]
        # Embed
        embeddings = embed_texts(chunk_texts) if chunk_texts else []
        print(f"[DEBUG] Generated {len(embeddings)} embeddings for PDF '{file.filename}'")
        # Create PDFDocument
        db_doc = models.PDFDocument(
            name=file.filename,
            upload_date=datetime.utcnow(),
            library_id=library_id,
            toc=toc,
            tags=""  # Default empty tags
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        # Add chunks to DB and vector store
        meta = []
        for (chunk_text, page_number, chunk_index, metadata), emb in zip(chunks, embeddings):
            db_chunk = models.DocumentChunk(
                content=chunk_text,
                page_number=page_number,
                chunk_index=chunk_index,
                document_id=db_doc.id,
                chunk_metadata=metadata
            )
            db.add(db_chunk)
            db.commit()
            db.refresh(db_chunk)
            meta.append((library_id, db_doc.id, db_chunk.id, page_number, chunk_index))
        if embeddings:
            vector_store.add_embeddings(embeddings, meta)
            print(f"[DEBUG] Added {len(embeddings)} embeddings to vector store for PDF '{file.filename}'")
        return db_doc
    except HTTPException:
        print(f"[ERROR] HTTPException during PDF upload for '{file.filename}'")
        raise
    except Exception as e:
        print(f"[ERROR] PDF processing error for '{file.filename}': {e}")
        raise HTTPException(status_code=500, detail="Failed to process PDF. Please try another file or check the PDF content.")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.put("/{library_id}/documents/{document_id}")
def update_document(library_id: str, document_id: str, update_data: dict, db: Session = Depends(get_db)):
    doc = db.query(models.PDFDocument).filter(models.PDFDocument.id == document_id, models.PDFDocument.library_id == library_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if "name" in update_data:
        doc.name = update_data["name"]
    if "tags" in update_data:
        doc.tags = update_data["tags"]
    
    db.commit()
    db.refresh(doc)
    return {"detail": "Document updated", "document": doc}

@router.delete("/{library_id}/documents/{document_id}")
def delete_document(library_id: str, document_id: str, db: Session = Depends(get_db)):
    doc = db.query(models.PDFDocument).filter(models.PDFDocument.id == document_id, models.PDFDocument.library_id == library_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"detail": "Document deleted"}

@router.get("/{library_id}/pdfs/{document_id}/processing-stats")
def get_document_processing_stats(library_id: str, document_id: str, db: Session = Depends(get_db)):
    """Get document processing statistics including table counts, OCR usage, etc."""
    doc = db.query(models.PDFDocument).filter(
        models.PDFDocument.id == document_id, 
        models.PDFDocument.library_id == library_id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get all chunks for this document
    chunks = db.query(models.DocumentChunk).filter(
        models.DocumentChunk.document_id == document_id
    ).all()
    
    # Calculate statistics
    total_chunks = len(chunks)
    total_pages = max([chunk.page_number for chunk in chunks]) if chunks else 0
    
    # Count tables and other metadata
    table_chunks = [c for c in chunks if c.chunk_metadata and c.chunk_metadata.get('is_table')]
    text_chunks = [c for c in chunks if not (c.chunk_metadata and c.chunk_metadata.get('is_table'))]
    
    # Calculate text statistics
    total_text_length = sum(len(c.content) for c in text_chunks)
    avg_chunk_length = total_text_length / len(text_chunks) if text_chunks else 0
    
    # Get unique sections/headings
    headings = set()
    toc_titles = set()
    for chunk in chunks:
        if chunk.chunk_metadata:
            if chunk.chunk_metadata.get('heading'):
                headings.add(chunk.chunk_metadata['heading'])
            if chunk.chunk_metadata.get('toc_title'):
                toc_titles.add(chunk.chunk_metadata['toc_title'])
    
    stats = {
        "document_id": document_id,
        "name": doc.name,
        "total_pages": total_pages,
        "total_chunks": total_chunks,
        "text_chunks": len(text_chunks),
        "table_chunks": len(table_chunks),
        "total_text_length": total_text_length,
        "average_chunk_length": round(avg_chunk_length, 2),
        "unique_headings": len(headings),
        "unique_toc_sections": len(toc_titles),
        "processing_quality": {
            "has_toc": bool(doc.toc),
            "has_tags": bool(doc.tags),
            "text_extraction_success": total_text_length > 0,
            "table_extraction_success": len(table_chunks) > 0
        }
    }
    
    return stats
