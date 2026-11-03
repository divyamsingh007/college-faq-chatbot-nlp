# College FAQ Chatbot

A sample RAG-based college FAQ assistant built with a React frontend, Node.js/Express backend, and a Python FastAPI NLP service. The project is designed as a practical academic implementation of semantic retrieval and answer generation using a local knowledge base.

## Features
- Modern chatbot interface
- Session-based conversation history
- FAQ retrieval using keyword fallback and semantic-style matching
- Document ingestion support for PDF and TXT files
- Local AI service orchestration with Python
- Source attribution in responses
- Docker-ready project layout

## Architecture
- Frontend: React + Vite + JavaScript
- Backend: Express + Node.js
- AI Service: FastAPI + Python
- Storage: JSON file store for local dev, plus vector retrieval flow for future ChromaDB integration

## Running locally
1. Install frontend dependencies: `npm --prefix client install`
2. Install server dependencies: `npm --prefix server install`
3. Install Python dependencies: `python -m venv ai-service/.venv && . ai-service/.venv/bin/activate && pip install -r ai-service/requirements.txt`
4. Start the AI service: `cd ai-service && . .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000`
5. Start the server: `cd server && npm run dev`
6. Start the client: `cd client && npm run dev -- --host 0.0.0.0`

## Project folders
- `client/` React application
- `server/` Express backend
- `ai-service/` Python FastAPI AI logic
- `docs/` project documentation
- `docker/` Docker compose configuration
- `scripts/` helper scripts

## Notes
This version is intentionally implemented in a lightweight local-development form so it runs reliably in a standard environment without external services such as MongoDB or a heavy Ollama installation. The AI pipeline is structured to be extended into a production-grade RAG stack by replacing the local JSON and in-memory retrieval components with hosted services.
