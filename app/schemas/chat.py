from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChatMessageSchema(BaseModel):
    id: str
    content: str
    role: str  # 'user' or 'assistant'
    timestamp: datetime
    sources: Optional[List[str]] = []

    class Config:
        from_attributes = True

class ConversationSchema(BaseModel):
    id: str
    library_id: str
    title: str
    messages: List[ChatMessageSchema] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None
    metadata_filter: Optional[dict] = None
    document_ids: Optional[List[str]] = None  # Filter by specific document IDs
    response_length: Optional[str] = "medium"  # "short", "medium", "long"

class ChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    conversation_id: str
