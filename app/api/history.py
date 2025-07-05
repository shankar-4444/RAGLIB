from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db import models
from app.schemas.chat import ConversationSchema
from typing import List

router = APIRouter()

@router.get("/{library_id}/conversations", response_model=List[ConversationSchema])
def list_conversations(library_id: str, db: Session = Depends(get_db)):
    # Use raw SQL to avoid session issues
    from sqlalchemy import text
    
    # Get conversations with messages in a single query
    query = text("""
        SELECT 
            c.id, c.library_id, c.title, c.created_at, c.updated_at,
            m.id as msg_id, m.content, m.role, m.timestamp, m.sources
        FROM conversations c
        LEFT JOIN chat_messages m ON c.id = m.conversation_id
        WHERE c.library_id = :library_id
        ORDER BY c.updated_at DESC, m.timestamp
    """)
    
    result = db.execute(query, {"library_id": library_id})
    
    # Group by conversation
    conversations = {}
    for row in result:
        conv_id = row.id
        if conv_id not in conversations:
            conversations[conv_id] = {
                "id": conv_id,
                "library_id": row.library_id,
                "title": row.title,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "messages": []
            }
        
        if row.msg_id:  # Only add message if it exists
            conversations[conv_id]["messages"].append({
                "id": row.msg_id,
                "content": row.content,
                "role": row.role,
                "timestamp": row.timestamp,
                "sources": row.sources.split(",") if row.sources else []
            })
    
    return list(conversations.values())

@router.get("/conversations/{conversation_id}", response_model=ConversationSchema)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    # Use raw SQL to avoid session issues
    from sqlalchemy import text
    
    # Get conversation with messages in a single query
    query = text("""
        SELECT 
            c.id, c.library_id, c.title, c.created_at, c.updated_at,
            m.id as msg_id, m.content, m.role, m.timestamp, m.sources
        FROM conversations c
        LEFT JOIN chat_messages m ON c.id = m.conversation_id
        WHERE c.id = :conversation_id
        ORDER BY m.timestamp
    """)
    
    result = db.execute(query, {"conversation_id": conversation_id})
    
    # Group by conversation
    conversation_data = None
    messages = []
    
    for row in result:
        if conversation_data is None:
            conversation_data = {
                "id": row.id,
                "library_id": row.library_id,
                "title": row.title,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "messages": []
            }
        
        if row.msg_id:  # Only add message if it exists
            messages.append({
                "id": row.msg_id,
                "content": row.content,
                "role": row.role,
                "timestamp": row.timestamp,
                "sources": row.sources.split(",") if row.sources else []
            })
    
    if conversation_data is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation_data["messages"] = messages
    return conversation_data

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conversation)
    db.commit()
    return {"detail": "Conversation deleted"}
