from __future__ import annotations

import re
from typing import Any, Dict, List

STOP_WORDS = {
    'a', 'about', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'how', 'i',
    'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what',
    'when', 'where', 'which', 'who', 'with', 'you'
}


def _tokens(text: str) -> set[str]:
    return {
        token for token in re.findall(r'[a-z0-9]+', text.lower())
        if token not in STOP_WORDS
    }


def retrieve_context(question: str, faqs: List[Dict[str, Any]], top_k: int = 5, similarity_threshold: float = 0.65) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    query_tokens = _tokens(question or '')
    if not query_tokens:
        return results

    for faq in faqs:
        text = f"{faq.get('question', '')} {faq.get('answer', faq.get('text', ''))}"
        score = len(query_tokens & _tokens(text)) / len(query_tokens)
        if score >= similarity_threshold / 2:
            results.append({
                'document_id': faq.get('document_id', faq.get('source', 'faq')),
                'document': faq.get('document', faq.get('source', 'FAQ')),
                'source_url': faq.get('source_url'),
                'page': faq.get('page', 1),
                'relevance': round(score, 4),
                '_title_relevance': len(query_tokens & _tokens(faq.get('document', ''))) / len(query_tokens),
                'text': faq.get('text', faq.get('answer', '')),
                'question': faq.get('question', '')
            })
    results.sort(key=lambda item: (item['relevance'], item['_title_relevance']), reverse=True)
    return [
        {key: value for key, value in item.items() if key != '_title_relevance'}
        for item in results[:top_k]
    ]
