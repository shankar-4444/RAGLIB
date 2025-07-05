from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import scoped_session
from app.db.models import Base

DATABASE_URL = "sqlite:///./raglib.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
