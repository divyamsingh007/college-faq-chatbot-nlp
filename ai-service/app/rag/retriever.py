from __future__ import annotations

from typing import Any, Dict, List


def retrieve_context(question: str, faqs: List[Dict[str, Any]], top_k: int = 5, similarity_threshold: float = 0.65) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    query = (question or '').lower()
    for faq in faqs:
        answer = str(faq.get('answer', ''))
        text = f"{faq.get('question', '')} {answer}".lower()
        overlap = sum(1 for token in query.split() if token in text)
        score = overlap / max(1, len(query.split()))
        if score >= similarity_threshold / 2:
            results.append({
                'document_id': faq.get('source', 'faq'),
                'document': faq.get('source', 'faq'),
                'page': 1,
                'relevance': round(score, 4),
                'text': faq.get('answer', ''),
                'question': faq.get('question', '')
            })
    results.sort(key=lambda item: item['relevance'], reverse=True)
    return results[:top_k]
