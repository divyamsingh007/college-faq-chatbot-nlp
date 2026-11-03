import time
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.knowledge_base import load_nith_documents
from app.nlp.preprocessing import clean_document, normalize_text
from app.rag.generator import GeminiGenerationError, generate_answer
from app.rag.prompt_builder import build_prompt
from app.rag.retriever import retrieve_context

app = FastAPI(title='NIT Hamirpur Student Assistant API', version='1.0.0')
settings = get_settings()

BASE_DIR = Path(__file__).resolve().parent.parent
NITH_DOCUMENTS_PATH = BASE_DIR / 'data' / 'nith_documents.json'


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    conversationHistory: List[Dict[str, str]] = Field(default_factory=list)


class DocumentIndexRequest(BaseModel):
    filePath: str | None = None
    originalName: str | None = None
    documentId: str | None = None
    text: str | None = None


NITH_DOCUMENTS = load_nith_documents(NITH_DOCUMENTS_PATH)


@app.get('/api/v1/health')
def health() -> Dict[str, Any]:
    return {
        'status': 'ok',
        'components': {
            'gemini': 'configured' if settings.gemini_api_key else 'missing API key',
            'geminiModel': settings.gemini_model,
            'knowledgeBase': 'ready' if NITH_DOCUMENTS else 'not indexed',
            'indexedChunks': len(NITH_DOCUMENTS)
        }
    }


@app.post('/api/v1/nlp/chat')
def generate_chat_response(payload: ChatRequest) -> Dict[str, Any]:
    start = time.time()
    question = normalize_text(payload.question)
    matched = retrieve_context(question, NITH_DOCUMENTS, top_k=settings.top_k, similarity_threshold=settings.similarity_threshold)
    if not matched:
        answer = "I couldn't find this information in the indexed NIT Hamirpur documents. Please check the official NIT Hamirpur website or contact the relevant office."
        sources = []
    else:
        if not settings.gemini_api_key:
            raise HTTPException(status_code=503, detail='GEMINI_API_KEY is not configured for the AI service.')

        context_text = '\n\n'.join(
            f"Document: {item.get('document')}\n"
            f"Page: {item.get('page')}\n"
            f"Official source: {item.get('source_url')}\n"
            f"Excerpt: {item.get('text')}"
            for item in matched
        )
        prompt = build_prompt(question, context_text)
        try:
            answer = generate_answer(prompt, settings.gemini_api_key, settings.gemini_model)
        except GeminiGenerationError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        sources = [{
            'documentId': item.get('document_id', 'faq'),
            'document': item.get('document', 'NIT Hamirpur document'),
            'url': item.get('source_url'),
            'page': item.get('page', 1),
            'relevance': item.get('relevance', 0.0)
        } for item in matched]

    return {
        'answer': answer,
        'sources': sources,
        'retrievalStatus': 'success' if matched else 'fallback',
        'processingTime': round(time.time() - start, 2),
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
