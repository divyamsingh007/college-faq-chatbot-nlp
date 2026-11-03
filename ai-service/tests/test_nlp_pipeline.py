import pytest

from fastapi.testclient import TestClient

from app import main
from app.knowledge_base import load_nith_documents
from app.nlp.preprocessing import clean_document, sentence_split
from app.rag.generator import GeminiConfigurationError, generate_answer
from app.rag.retriever import retrieve_context


def test_clean_document_removes_extra_whitespace():
    text = '  College   admissions  require   forms.  '

    result = clean_document(text)
    assert '  ' not in result
    assert 'College admissions require forms.' in result


def test_sentence_split_handles_basic_sentences():
    text = 'Admissions open in July. Students apply online. The process is clear.'
    sentences = sentence_split(text)
    assert len(sentences) == 3


def test_retriever_returns_official_document_source_and_page():
    documents = [
        {
            'document_id': 'nith-academic-calendar-odd-2026-27',
            'document': 'NIT Hamirpur Academic Calendar, Odd Semester 2026-27',
            'source_url': 'https://nith.ac.in/uploads/topics/17244223408638.pdf',
            'page': 1,
            'text': 'Commencement of Classes for first year UG programmes is 20th August 2026.'
        }
    ]

    matches = retrieve_context('When do first year UG classes commence?', documents, top_k=5, similarity_threshold=0.65)
    assert len(matches) == 1
    assert matches[0]['document_id'] == 'nith-academic-calendar-odd-2026-27'
    assert matches[0]['source_url'].startswith('https://nith.ac.in/')
    assert matches[0]['page'] == 1


def test_retriever_ranks_specific_fee_document_above_unrelated_hostel_excerpt():
    documents = [
        {
            'document': 'NIT Hamirpur Hostel Booklet 2026-27',
            'text': 'Fee structure for B. Tech students includes a separate hostel mess fee.'
        },
        {
            'document': 'NIT Hamirpur Fee Structure',
            'text': 'Fee structure for B. Tech students admitted in academic session 2023-24 and onwards.'
        }
    ]

    matches = retrieve_context('fee structure for B Tech', documents, top_k=2, similarity_threshold=0.65)

    assert matches[0]['document'] == 'NIT Hamirpur Fee Structure'


def test_load_nith_documents_returns_empty_when_not_indexed(tmp_path):
    assert load_nith_documents(tmp_path / 'not-indexed.json') == []


def test_gemini_generator_requires_an_api_key():
    with pytest.raises(GeminiConfigurationError, match='GEMINI_API_KEY'):
        generate_answer('Question and source context', '', 'gemini-2.5-flash')


def test_gemini_generator_sends_key_in_header(monkeypatch):
    captured = {}

    class FakeResponse:
        is_error = False
        status_code = 200

        @staticmethod
        def json():
            return {'candidates': [{'content': {'parts': [{'text': 'Classes begin on 20 August 2026.'}]}}]}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        @staticmethod
        def post(url, headers, json):
            captured.update({'url': url, 'headers': headers, 'payload': json})
            return FakeResponse()

    monkeypatch.setattr('app.rag.generator.httpx.Client', lambda **_kwargs: FakeClient())
    answer = generate_answer('Use only official context.', 'test-secret', 'gemini-2.5-flash')

    assert answer == 'Classes begin on 20 August 2026.'
    assert captured['headers']['x-goog-api-key'] == 'test-secret'
    assert 'test-secret' not in captured['url']


def test_chat_endpoint_uses_official_context_and_returns_source_link(monkeypatch):
    source = {
        'document_id': 'nith-academic-calendar-odd-2026-27',
        'document': 'NIT Hamirpur Academic Calendar, Odd Semester 2026-27',
        'source_url': 'https://nith.ac.in/uploads/topics/17244223408638.pdf',
        'page': 1,
        'text': 'Commencement of Classes for first year UG programmes is 20th August 2026.'
    }
    captured = {}
    monkeypatch.setattr(main, 'NITH_DOCUMENTS', [source])
    monkeypatch.setattr(main.settings, 'gemini_api_key', 'test-secret')

    def fake_generate_answer(prompt, api_key, model):
        captured.update({'prompt': prompt, 'api_key': api_key, 'model': model})
        return 'First-year UG classes commence on 20 August 2026.'

    monkeypatch.setattr(main, 'generate_answer', fake_generate_answer)
    response = TestClient(main.app).post(
        '/api/v1/nlp/chat',
        json={'question': 'When do first year UG classes commence?'}
    )

    assert response.status_code == 200
    assert response.json()['answer'].startswith('First-year UG classes')
    assert response.json()['sources'][0]['url'] == source['source_url']
    assert response.json()['sources'][0]['page'] == 1
    assert source['text'] in captured['prompt']
    assert captured['api_key'] == 'test-secret'
    assert captured['model'] == main.settings.gemini_model


def test_chat_endpoint_reports_missing_key_when_source_matches(monkeypatch):
    monkeypatch.setattr(main, 'NITH_DOCUMENTS', [{
        'document_id': 'nith-fee-structure',
        'document': 'NIT Hamirpur Fee Structure',
        'source_url': 'https://nith.ac.in/uploads/files/nov24/feestructure.pdf',
        'page': 1,
        'text': 'Tuition fee fee structure for admitted students.'
    }])
    monkeypatch.setattr(main.settings, 'gemini_api_key', '')

    response = TestClient(main.app).post(
        '/api/v1/nlp/chat',
        json={'question': 'What is the tuition fee structure?'}
    )

    assert response.status_code == 503
    assert response.json()['detail'] == 'GEMINI_API_KEY is not configured for the AI service.'
