from __future__ import annotations

from typing import List, Dict, Any


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 100, metadata: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    metadata = metadata or {}
    words = text.split()
    chunks: List[Dict[str, Any]] = []
    step = max(1, chunk_size - chunk_overlap)

    for index in range(0, len(words), step):
        segment = words[index:index + chunk_size]
        if not segment:
            continue
        chunk_text_value = ' '.join(segment)
        chunk = {
            'text': chunk_text_value,
            'chunk_index': len(chunks),
            'document_id': metadata.get('document_id', 'unknown'),
            'document_name': metadata.get('document_name', 'unknown'),
            'page_number': metadata.get('page_number'),
            'category': metadata.get('category', 'general'),
            'source': metadata.get('source', 'dataset')
        }
        chunks.append(chunk)

    return chunks
