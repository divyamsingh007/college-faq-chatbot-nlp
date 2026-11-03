from __future__ import annotations

from typing import List, Dict


def generate_answer(question: str, context_items: List[Dict[str, str]]) -> str:
    if not context_items:
        return "I couldn't find reliable information about this topic in my current college knowledge base. Please contact the relevant department for assistance."

    best = context_items[0]
    answer = best.get('text', '')
    if not answer:
        return "I couldn't find reliable information about this topic in my current college knowledge base. Please contact the relevant department for assistance."

    normalized = answer.strip()
    if normalized.endswith('.'):
        return normalized
    return normalized + '.'
