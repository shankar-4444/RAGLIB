from sentence_transformers import SentenceTransformer
from typing import List

# You can use a small model for local testing
MODEL_NAME = "all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)

def embed_texts(texts: List[str]) -> List[List[float]]:
    return model.encode(texts, show_progress_bar=False).tolist()
