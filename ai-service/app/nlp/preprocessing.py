import re
from typing import List


def normalize_text(text: str) -> str:
    if not text:
        return ''
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def sentence_split(text: str) -> List[str]:
    normalized = normalize_text(text)
    pieces = re.split(r'(?<=[.!?])\s+', normalized)
    return [piece.strip() for piece in pieces if piece.strip()]


def tokenize(text: str) -> List[str]:
    normalized = normalize_text(text)
    return re.findall(r"\b[\w'-]+\b", normalized.lower())


def clean_document(raw_text: str) -> str:
    cleaned = raw_text or ''
    cleaned = cleaned.replace('\t', ' ')
    cleaned = re.sub(r'\n{2,}', '\n', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    return cleaned.strip()
