from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db import models
from app.schemas.chat import ConversationSchema, ConversationUpdateSchema, ChatMessageSchema
from typing import List

router = APIRouter()
debug_router = APIRouter()

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

@router.patch("/conversations/{conversation_id}", response_model=ConversationSchema)
def update_conversation_title(conversation_id: str, update: ConversationUpdateSchema = Body(...), db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation.title = update.title
    db.commit()
    db.refresh(conversation)
    # Return updated conversation with messages
    # (reuse get_conversation logic for consistency)
    return get_conversation(conversation_id, db)

@router.post("/{library_id}/conversations", response_model=ConversationSchema)
def create_conversation(library_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    title = data.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    conversation = models.Conversation(library_id=library_id, title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    # Return the new conversation with empty messages
    return {
        "id": conversation.id,
        "library_id": conversation.library_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": []
    }

@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageSchema)
def add_message_to_conversation(conversation_id: str, message: ChatMessageSchema = Body(...), db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg = models.ChatMessage(
        id=message.id,
        conversation_id=conversation_id,
        content=message.content,
        role=message.role,
        timestamp=message.timestamp,
        sources=",".join(message.sources) if message.sources else None
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return message

@debug_router.get("/all_conversations_debug", response_model=List[ConversationSchema])
def list_all_conversations_debug(db: Session = Depends(get_db)):
    conversations = db.query(models.Conversation).all()
    result = []
    for conv in conversations:
        result.append({
            "id": conv.id,
            "library_id": conv.library_id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "messages": []
        })
    return result
