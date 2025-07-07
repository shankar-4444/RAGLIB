from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import libraries, pdfs, chat, history
from app.db.session import engine
from app.db import models
from app.rag.vector_store import vector_store
from app.api.history import debug_router

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="RAG Library API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(libraries.router, prefix="/libraries", tags=["libraries"])
app.include_router(pdfs.router, prefix="/libraries", tags=["pdfs"])
app.include_router(chat.router, prefix="/libraries", tags=["chat"])
app.include_router(history.router, prefix="/libraries", tags=["history"])
app.include_router(debug_router)

@app.on_event("startup")
async def startup_event():
    """Rebuild FAISS index on startup if it's empty"""
    from app.db.session import SessionLocal
    
    # Check if index is empty
    stats = vector_store.get_stats()
    if stats["total_embeddings"] == 0:
        print("[INFO] FAISS index is empty, rebuilding from database...")
        db = SessionLocal()
        try:
            vector_store.rebuild_from_database(db)
        finally:
            db.close()
    else:
        print(f"[INFO] FAISS index loaded with {stats['total_embeddings']} embeddings")

@app.get("/")
async def root():
    return {"message": "RAG Library API is running"}

@app.get("/health")
async def health_check():
    stats = vector_store.get_stats()
    return {
        "status": "healthy",
        "vector_store": stats
    }
