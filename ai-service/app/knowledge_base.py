from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


def load_nith_documents(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []

    with path.open('r', encoding='utf-8') as document_file:
        documents = json.load(document_file)
    if not isinstance(documents, list):
        raise ValueError(f'NIT Hamirpur document index must contain a JSON list: {path}')
    return [document for document in documents if isinstance(document, dict) and document.get('text')]
