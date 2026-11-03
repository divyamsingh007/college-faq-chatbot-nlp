# NIT Hamirpur Student Assistant

An NIT Hamirpur information assistant built with a React frontend, Node.js/Express backend, and a Python FastAPI AI service. It retrieves passages from official NIT Hamirpur documents and uses Gemini to compose grounded answers with source citations.

## Features
- Modern chatbot interface
- Session-based conversation history
- Retrieval from official NIT Hamirpur documents
- Gemini-generated answers grounded in retrieved passages
- Downloading and indexing official NIT Hamirpur PDFs
- Local AI service orchestration with Python
- Source attribution in responses
- Docker-ready project layout

## Architecture
- Frontend: React + Vite + JavaScript
- Backend: Express + Node.js
- AI Service: FastAPI + Python
- Storage: JSON file store for chat sessions and a generated local index of official NIT Hamirpur documents

## Running locally
1. Install frontend dependencies: `npm --prefix client install`
2. Install server dependencies: `npm --prefix server install`
3. Create and install the Python environment:
   - Windows PowerShell: `py -m venv ai-service\.venv` then `ai-service\.venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt`
   - macOS/Linux: `python3 -m venv ai-service/.venv` then `ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt`
4. Copy `ai-service/.env.example` to `ai-service/.env` and set `GEMINI_API_KEY` to your own Gemini API key. Keep this secret out of source control.
5. Download and index the official NIT Hamirpur documents:
   - Windows PowerShell: `ai-service\.venv\Scripts\python.exe scripts\ingest_nith_documents.py`
   - macOS/Linux: `ai-service/.venv/bin/python scripts/ingest_nith_documents.py`
6. Start the AI service from `ai-service/`: `.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000` on Windows, or `.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` on macOS/Linux.
7. Start the server from `server/`: `npm run dev`
8. Start the client from `client/`: `npm run dev -- --host 0.0.0.0`

The document index is generated locally from official PDFs linked on [nith.ac.in](https://nith.ac.in). It includes the 2026-27 hostel booklet, current academic calendars, and institute fee structure. The PDFs are fetched for extraction but are not retained; the generated text index is local and ignored by Git. Run the ingestion command again to refresh it.

## Project folders
- `client/` React application
- `server/` Express backend
- `ai-service/` Python FastAPI AI logic
- `docs/` project documentation
- `docker/` Docker compose configuration
- `scripts/` helper scripts

## Configuration and data
- Gemini credentials are read from `GEMINI_API_KEY`; the key is never sent to the browser or stored in source code.
- The AI service reports when the key is missing and returns an explicit service error rather than silently pretending to use Gemini.
- Answers are generated only when relevant official document passages are retrieved. Each response includes the title, URL, and page of its source passages.
- Source document URLs and versions are listed in `ai-service/data/nith_sources.json`; the generated index remains local and is not committed.
