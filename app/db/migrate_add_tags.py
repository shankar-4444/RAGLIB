import sqlite3
import os

def migrate_add_tags():
    """Add tags column to pdf_documents table if it doesn't exist."""
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'raglib.db')
    
    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if tags column already exists
        cursor.execute("PRAGMA table_info(pdf_documents)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'tags' not in columns:
            print("Adding tags column to pdf_documents table...")
            cursor.execute("ALTER TABLE pdf_documents ADD COLUMN tags TEXT")
            conn.commit()
            print("Successfully added tags column to pdf_documents table.")
        else:
            print("Tags column already exists in pdf_documents table.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_add_tags() 