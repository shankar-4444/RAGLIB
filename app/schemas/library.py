from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentChunkSchema(BaseModel):
    id: str
    content: str
    page_number: int
    chunk_index: int

    class Config:
        from_attributes = True

class PDFDocumentSchema(BaseModel):
    id: str
    name: str
    upload_date: datetime
    chunks: List[DocumentChunkSchema] = []

    class Config:
        from_attributes = True

class LibraryBase(BaseModel):
    name: str
    description: Optional[str] = None
    tags: Optional[str] = None

class LibraryCreate(LibraryBase):
    pass

class LibrarySchema(LibraryBase):
    id: str
    created_at: datetime
    documents: List[PDFDocumentSchema] = []

    class Config:
        from_attributes = True
