import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import fitz
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'ai-service' / 'data'
SOURCES_PATH = DATA_DIR / 'nith_sources.json'
INDEX_PATH = DATA_DIR / 'nith_documents.json'
MAX_DOCUMENT_BYTES = 30 * 1024 * 1024
load_dotenv(ROOT / 'ai-service' / '.env')
CHUNK_WORDS = int(os.getenv('CHUNK_SIZE', '500'))
OVERLAP_WORDS = int(os.getenv('CHUNK_OVERLAP', '100'))


def download_pdf(url: str) -> bytes:
    parsed_url = urlparse(url)
    if (
        parsed_url.scheme != 'https'
        or parsed_url.hostname != 'nith.ac.in'
        or not parsed_url.path.lower().endswith('.pdf')
    ):
        raise ValueError(f'Only official NIT Hamirpur PDF URLs are allowed: {url}')

    request = Request(url, headers={'User-Agent': 'NITH-FAQ-Document-Indexer/1.0'})
    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get_content_type()
        data = response.read(MAX_DOCUMENT_BYTES + 1)

    if content_type != 'application/pdf' and not data.startswith(b'%PDF-'):
        raise ValueError(f'Expected a PDF from the official source, got {content_type}: {url}')
    if len(data) > MAX_DOCUMENT_BYTES:
        raise ValueError(f'Official PDF exceeds the {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB limit: {url}')
    return data


def chunk_page(text: str, source: dict, page_number: int) -> list[dict]:
    words = re.sub(r'\s+', ' ', text).split()
    step = max(1, CHUNK_WORDS - OVERLAP_WORDS)
    chunks = []
    for start in range(0, len(words), step):
        excerpt = ' '.join(words[start:start + CHUNK_WORDS]).strip()
        if excerpt:
            chunks.append({
                'id': f"{source['id']}-p{page_number}-c{len(chunks) + 1}",
                'document_id': source['id'],
                'document': source['title'],
                'source_url': source['url'],
                'page': page_number,
                'text': excerpt,
            })
    return chunks


def main() -> None:
    with SOURCES_PATH.open('r', encoding='utf-8') as source_file:
        sources = json.load(source_file)

    indexed_chunks = []
    for source in sources:
        pdf_bytes = download_pdf(source['url'])
        pdf = fitz.open(stream=pdf_bytes, filetype='pdf')
        source_chunks = []
        for page_number, page in enumerate(pdf, start=1):
            source_chunks.extend(chunk_page(page.get_text(), source, page_number))
        if not source_chunks:
            raise ValueError(f"No extractable text found in official source: {source['url']}")
        indexed_chunks.extend(source_chunks)
        print(f"Indexed {len(source_chunks)} passages from {source['title']} ({len(pdf)} pages).")

    INDEX_PATH.write_text(
        json.dumps(indexed_chunks, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f'Wrote {len(indexed_chunks)} passages to {INDEX_PATH}')


if __name__ == '__main__':
    main()
