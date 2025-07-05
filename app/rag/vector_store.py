import faiss
import numpy as np
from typing import List, Tuple
import os
import pickle

class VectorStore:
    def __init__(self, dim: int = 384, index_path: str = "faiss_index.bin", meta_path: str = "faiss_meta.pkl"):
        self.index_path = index_path
        self.meta_path = meta_path
        self.dim = dim
        
        # Try to load existing index
        if os.path.exists(index_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(meta_path, 'rb') as f:
                    self.embeddings = pickle.load(f)
                print(f"[INFO] Loaded existing FAISS index with {len(self.embeddings)} embeddings")
            except Exception as e:
                print(f"[WARNING] Failed to load existing index: {e}. Creating new index.")
                self.index = faiss.IndexFlatL2(dim)
                self.embeddings = []
        else:
            self.index = faiss.IndexFlatL2(dim)
            self.embeddings = []

    def add_embeddings(self, vectors: List[List[float]], meta: List[Tuple[str, str, str, int, int]]):
        arr = np.array(vectors).astype('float32')
        self.index.add(arr)
        self.embeddings.extend(meta)
        self._save_index()

    def search_embeddings(self, query_vector: List[float], top_k: int = 5):
        arr = np.array([query_vector]).astype('float32')
        D, I = self.index.search(arr, top_k)
        results = []
        for idx in I[0]:
            if 0 <= idx < len(self.embeddings):
                results.append(self.embeddings[idx])
        return results

    def _save_index(self):
        """Save the FAISS index and metadata to disk"""
        try:
            faiss.write_index(self.index, self.index_path)
            with open(self.meta_path, 'wb') as f:
                pickle.dump(self.embeddings, f)
            print(f"[INFO] Saved FAISS index with {len(self.embeddings)} embeddings")
        except Exception as e:
            print(f"[ERROR] Failed to save FAISS index: {e}")

    def rebuild_from_database(self, db_session):
        """Rebuild the index from the database"""
        from app.rag.embedder import embed_texts
        from app.db import models
        
        print("[INFO] Rebuilding FAISS index from database...")
        
        # Clear existing index
        self.index = faiss.IndexFlatL2(self.dim)
        self.embeddings = []
        
        # Get all chunks from database
        chunks = db_session.query(models.DocumentChunk).all()
        if not chunks:
            print("[INFO] No chunks found in database")
            return
        
        # Group chunks by document for efficient embedding
        doc_chunks = {}
        for chunk in chunks:
            if chunk.document_id not in doc_chunks:
                doc_chunks[chunk.document_id] = []
            doc_chunks[chunk.document_id].append(chunk)
        
        total_embeddings = 0
        for doc_id, doc_chunk_list in doc_chunks.items():
            # Get document and library info
            doc = db_session.query(models.PDFDocument).filter(models.PDFDocument.id == doc_id).first()
            if not doc:
                continue
                
            # Prepare texts and metadata
            texts = [chunk.content for chunk in doc_chunk_list]
            embeddings = embed_texts(texts)
            
            # Prepare metadata
            meta = []
            for chunk, emb in zip(doc_chunk_list, embeddings):
                meta.append((doc.library_id, doc_id, chunk.id, chunk.page_number, chunk.chunk_index))
            
            # Add to index
            if embeddings:
                arr = np.array(embeddings).astype('float32')
                self.index.add(arr)
                self.embeddings.extend(meta)
                total_embeddings += len(embeddings)
        
        # Save the rebuilt index
        self._save_index()
        print(f"[INFO] Rebuilt FAISS index with {total_embeddings} embeddings from {len(doc_chunks)} documents")

    def get_stats(self):
        """Get statistics about the vector store"""
        return {
            "total_embeddings": len(self.embeddings),
            "index_size": self.index.ntotal if hasattr(self.index, 'ntotal') else 0,
            "dimension": self.dim
        }

vector_store = VectorStore()
