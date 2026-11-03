import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
faq_file = root / 'ai-service' / 'data' / 'faqs.json'
out_file = root / 'ai-service' / 'data' / 'seeded_faqs.json'

with faq_file.open('r', encoding='utf-8') as handle:
    faqs = json.load(handle)

with out_file.open('w', encoding='utf-8') as handle:
    json.dump(faqs, handle, indent=2)

print(f'Seeded {len(faqs)} FAQs into {out_file}')
