from __future__ import annotations

from typing import Any, Dict, List


class ChromaStore:
    def __init__(self):
        self.collection: Dict[str, Dict[str, Any]] = {}

    def add_documents(self, documents: List[Dict[str, Any]]) -> None:
        for document in documents:
            identifier = document.get('id') or f"chunk-{len(self.collection)}"
            self.collection[identifier] = document

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for document in self.collection.values():
            text = str(document.get('text', '')).lower()
            query_text = query.lower()
            overlap = sum(1 for term in query_text.split() if term in text)
            score = overlap / max(1, len(query_text.split()))
            if score > 0:
                results.append({**document, 'score': round(score, 4)})
        results.sort(key=lambda item: item.get('score', 0.0), reverse=True)
        return results[:top_k]

    def delete_document(self, document_id: str) -> None:
        self.collection = {key: value for key, value in self.collection.items() if value.get('document_id') != document_id}

    def health_check(self) -> Dict[str, Any]:
        return {'status': 'simulated', 'message': 'Vector store is running in local development mode.'}
