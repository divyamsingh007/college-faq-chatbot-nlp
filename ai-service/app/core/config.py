import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parents[2] / '.env')


class Settings(BaseModel):
    host: str = os.getenv('HOST', '0.0.0.0')
    port: int = int(os.getenv('PORT', '8000'))
    gemini_api_key: str = os.getenv('GEMINI_API_KEY', '').strip()
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
    chunk_size: int = int(os.getenv('CHUNK_SIZE', '500'))
    chunk_overlap: int = int(os.getenv('CHUNK_OVERLAP', '100'))
    top_k: int = int(os.getenv('TOP_K', '5'))
    similarity_threshold: float = float(os.getenv('SIMILARITY_THRESHOLD', '0.65'))


@lru_cache
def get_settings() -> Settings:
    return Settings()
