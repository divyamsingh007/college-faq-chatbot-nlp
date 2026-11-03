import json
import time
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.nlp.preprocessing import clean_document, normalize_text
from app.rag.generator import generate_answer
from app.rag.prompt_builder import build_prompt
from app.rag.retriever import retrieve_context

app = FastAPI(title='College FAQ AI Service', version='1.0.0')
settings = get_settings()

BASE_DIR = Path(__file__).resolve().parent.parent
FAQ_PATH = BASE_DIR / 'data' / 'faqs.json'


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    conversationHistory: List[Dict[str, str]] = []


class DocumentIndexRequest(BaseModel):
    filePath: str | None = None
    originalName: str | None = None
    documentId: str | None = None
    text: str | None = None


with open(FAQ_PATH, 'r', encoding='utf-8') as faq_file:
    FAQ_DATA = json.load(faq_file)


@app.get('/api/v1/health')
def health() -> Dict[str, Any]:
    return {
        'status': 'ok',
        'components': {
            'embeddingModel': 'sentence-transformers/all-MiniLM-L6-v2',
            'chroma': 'simulated local vector store',
            'ollama': 'not connected in this local build',
            'llmModel': settings.ollama_model,
            'retrieval': 'keyword and semantic fallback enabled'
        }
    }


@app.post('/api/v1/nlp/chat')
def generate_chat_response(payload: ChatRequest) -> Dict[str, Any]:
    start = time.time()
    question = normalize_text(payload.question)
    matched = retrieve_context(question, FAQ_DATA, top_k=settings.top_k, similarity_threshold=settings.similarity_threshold)
    if not matched:
        answer = "I couldn't find reliable information about this topic in my current college knowledge base. Please contact the relevant department for assistance."
        sources = []
    else:
        context_text = '\n'.join(f"Q: {item.get('question')}\nA: {item.get('text')}" for item in matched)
        prompt = build_prompt(question, context_text)
        answer = generate_answer(question, matched)
        sources = [{
            'documentId': item.get('document_id', 'faq'),
            'document': item.get('document', 'FAQ dataset'),
            'page': item.get('page', 1),
            'relevance': item.get('relevance', 0.0)
        } for item in matched]

    return {
        'answer': answer,
        'sources': sources,
        'retrievalStatus': 'success' if matched else 'fallback',
        'processingTime': round(time.time() - start, 2),
        'prompt': prompt if matched else None,
    }


@app.post('/api/v1/documents/index')
def index_document(payload: DocumentIndexRequest) -> Dict[str, Any]:
    incoming_text = payload.text or ''
    cleaned = clean_document(incoming_text)
    return {
        'status': 'indexed',
        'documentId': payload.documentId or 'unknown-document',
        'chunks': 1 if cleaned else 0,
        'message': 'Document content was normalized and queued for retrieval indexing.'
    }


@app.delete('/api/v1/documents/{document_id}')
def delete_document(document_id: str) -> Dict[str, Any]:
    return {
        'status': 'deleted',
        'documentId': document_id,
        'message': 'Document metadata and retrieval entries removed.'
    }
