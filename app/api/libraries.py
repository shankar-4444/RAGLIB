from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db import models
from app.schemas.library import LibrarySchema, LibraryCreate
from typing import List
from datetime import datetime
from app.rag.vector_store import vector_store

router = APIRouter()

@router.get("/", response_model=List[LibrarySchema])
def list_libraries(db: Session = Depends(get_db)):
    # Use raw SQL to avoid session issues
    from sqlalchemy import text
    
    # Get libraries with documents and chunks in a single query
    query = text("""
        SELECT 
            l.id, l.name, l.description, l.created_at, l.tags,
            d.id as doc_id, d.name as doc_name, d.upload_date, d.library_id, d.toc,
            c.id as chunk_id, c.content, c.page_number, c.chunk_index
        FROM libraries l
        LEFT JOIN pdf_documents d ON l.id = d.library_id
        LEFT JOIN document_chunks c ON d.id = c.document_id
        ORDER BY l.created_at DESC, d.upload_date DESC, c.page_number, c.chunk_index
    """)
    
    result = db.execute(query)
    
    # Group by library and document
    libraries = {}
    for row in result:
        lib_id = row.id
        if lib_id not in libraries:
            libraries[lib_id] = {
                "id": lib_id,
                "name": row.name,
                "description": row.description,
                "created_at": row.created_at,
                "tags": row.tags,
                "documents": {}
            }
        
        if row.doc_id:  # Only add document if it exists
            doc_id = row.doc_id
            if doc_id not in libraries[lib_id]["documents"]:
                libraries[lib_id]["documents"][doc_id] = {
                    "id": doc_id,
                    "name": row.doc_name,
                    "upload_date": row.upload_date,
                    "library_id": row.library_id,
                    "toc": row.toc,
                    "chunks": []
                }
            
            if row.chunk_id:  # Only add chunk if it exists
                libraries[lib_id]["documents"][doc_id]["chunks"].append({
                    "id": row.chunk_id,
                    "content": row.content,
                    "page_number": row.page_number,
                    "chunk_index": row.chunk_index
                })
    
    # Convert documents dict to list
    for lib in libraries.values():
        lib["documents"] = list(lib["documents"].values())
    
    return list(libraries.values())

@router.post("/", response_model=LibrarySchema)
def create_library(library: LibraryCreate, db: Session = Depends(get_db)):
    db_library = models.Library(
        name=library.name,
        description=library.description,
        tags=library.tags,
        created_at=datetime.utcnow()
    )
    db.add(db_library)
    db.commit()
    db.refresh(db_library)
    return db_library

@router.delete("/{library_id}")
def delete_library(library_id: str, db: Session = Depends(get_db)):
    library = db.query(models.Library).filter(models.Library.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")
    db.delete(library)
    db.commit()
    return {"detail": "Library deleted"}

@router.get("/{library_id}", response_model=LibrarySchema)
def get_library(library_id: str, db: Session = Depends(get_db)):
    # Use raw SQL to avoid session issues
    from sqlalchemy import text
    
    # Get library with documents and chunks in a single query
    query = text("""
        SELECT 
            l.id, l.name, l.description, l.created_at, l.tags,
            d.id as doc_id, d.name as doc_name, d.upload_date, d.library_id, d.toc,
            c.id as chunk_id, c.content, c.page_number, c.chunk_index
        FROM libraries l
        LEFT JOIN pdf_documents d ON l.id = d.library_id
        LEFT JOIN document_chunks c ON d.id = c.document_id
        WHERE l.id = :library_id
        ORDER BY d.upload_date DESC, c.page_number, c.chunk_index
    """)
    
    result = db.execute(query, {"library_id": library_id})
    
    # Group by document
    documents = {}
    library_data = None
    
    for row in result:
        if library_data is None:
            library_data = {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "created_at": row.created_at,
                "tags": row.tags,
                "documents": {}
            }
        
        if row.doc_id:  # Only add document if it exists
            doc_id = row.doc_id
            if doc_id not in documents:
                documents[doc_id] = {
                    "id": doc_id,
                    "name": row.doc_name,
                    "upload_date": row.upload_date,
                    "library_id": row.library_id,
                    "toc": row.toc,
                    "chunks": []
                }
            
            if row.chunk_id:  # Only add chunk if it exists
                documents[doc_id]["chunks"].append({
                    "id": row.chunk_id,
                    "content": row.content,
                    "page_number": row.page_number,
                    "chunk_index": row.chunk_index
                })
    
    if library_data is None:
        raise HTTPException(status_code=404, detail="Library not found")
    
    library_data["documents"] = list(documents.values())
    return library_data

@router.post("/rebuild-index")
def rebuild_vector_index(db: Session = Depends(get_db)):
    """Manually rebuild the FAISS vector index from the database"""
    try:
        vector_store.rebuild_from_database(db)
        stats = vector_store.get_stats()
        return {
            "message": "Vector index rebuilt successfully",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rebuild index: {str(e)}")

@router.get("/vector-store/stats")
def get_vector_store_stats():
    """Get statistics about the vector store"""
    return vector_store.get_stats()
