from app.nlp.preprocessing import clean_document, sentence_split
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


def test_retriever_works_on_demo_faqs():
    faq_data = [
        {'question': 'How can I apply for admission?', 'answer': 'Applications are submitted through the official admissions portal.', 'source': 'sample'}
    ]

    matches = retrieve_context('How to apply for admission?', faq_data, top_k=5, similarity_threshold=0.65)
    assert len(matches) >= 1
