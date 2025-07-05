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

class PDFDocumentCreate(BaseModel):
    name: str
    tags: Optional[str] = None
    # file will be handled as UploadFile in FastAPI endpoint

class PDFDocumentUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[str] = None

class PDFDocumentSchema(BaseModel):
    id: str
    name: str
    upload_date: datetime
    tags: Optional[str] = None
    chunks: List[DocumentChunkSchema] = []

    class Config:
        from_attributes = True
