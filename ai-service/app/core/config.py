import os
from functools import lru_cache

from pydantic import BaseModel


class Settings(BaseModel):
    host: str = os.getenv('HOST', '0.0.0.0')
    port: int = int(os.getenv('PORT', '8000'))
    ollama_base_url: str = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
    ollama_model: str = os.getenv('OLLAMA_MODEL', 'gemma3:4b')
    embedding_model: str = os.getenv('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
    chunk_size: int = int(os.getenv('CHUNK_SIZE', '500'))
    chunk_overlap: int = int(os.getenv('CHUNK_OVERLAP', '100'))
    top_k: int = int(os.getenv('TOP_K', '5'))
    similarity_threshold: float = float(os.getenv('SIMILARITY_THRESHOLD', '0.65'))


@lru_cache
def get_settings() -> Settings:
    return Settings()
