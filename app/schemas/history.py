from pydantic import BaseModel
from typing import List
from datetime import datetime

class ConversationHistoryItem(BaseModel):
    id: str
    library_id: str
    title: str
    updated_at: datetime
    message_count: int

class ConversationHistoryList(BaseModel):
    conversations: List[ConversationHistoryItem]
