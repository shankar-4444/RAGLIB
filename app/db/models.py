from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Table
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.sqlite import BLOB
from sqlalchemy.types import JSON
import datetime
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Library(Base):
    __tablename__ = 'libraries'
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    tags = Column(Text)  # Comma-separated tags
    documents = relationship('PDFDocument', back_populates='library', cascade="all, delete-orphan")
    conversations = relationship('Conversation', back_populates='library', cascade="all, delete-orphan")

class PDFDocument(Base):
    __tablename__ = 'pdf_documents'
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    library_id = Column(String, ForeignKey('libraries.id'))
    library = relationship('Library', back_populates='documents')
    chunks = relationship('DocumentChunk', back_populates='document', cascade="all, delete-orphan")
    toc = Column(JSON, nullable=True)  # Table of Contents as JSON
    tags = Column(Text, nullable=True)  # Comma-separated tags for the document

class DocumentChunk(Base):
    __tablename__ = 'document_chunks'
    id = Column(String, primary_key=True, default=generate_uuid)
    content = Column(Text, nullable=False)
    page_number = Column(Integer)
    chunk_index = Column(Integer)
    document_id = Column(String, ForeignKey('pdf_documents.id'))
    document = relationship('PDFDocument', back_populates='chunks')
    chunk_metadata = Column(JSON, nullable=True)  # Flexible metadata for chunk (chapter, section, heading, etc.)
    # Embeddings will be stored in vector store, not DB

class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(String, primary_key=True, default=generate_uuid)
    library_id = Column(String, ForeignKey('libraries.id'))
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    library = relationship('Library', back_populates='conversations')
    messages = relationship('ChatMessage', back_populates='conversation', cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey('conversations.id'))
    content = Column(Text, nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    sources = Column(Text)  # Comma-separated sources
    conversation = relationship('Conversation', back_populates='messages')
