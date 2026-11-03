from __future__ import annotations

from typing import List, Optional

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None


class EmbeddingService:
    def __init__(self, model_name: str = 'sentence-transformers/all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model = None
        if SentenceTransformer is not None:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception:
                self.model = None

    def encode(self, text: str | List[str]) -> List[float] | List[List[float]]:
        if self.model is None:
            vector = [0.0] * 384
            if isinstance(text, list):
                return [vector for _ in text]
            return vector

        values = self.model.encode(text)
        if isinstance(values, list) and isinstance(values[0], (int, float)):
            return values
        return values.tolist()
