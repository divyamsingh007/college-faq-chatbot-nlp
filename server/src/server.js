import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { readSessions, saveSession, deleteSessionData, readDocuments, writeDocuments } from './dataStore.js';

const app = express();
const uploadDir = path.resolve(process.cwd(), config.uploadDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(pdf|txt)$/i)) {
      return cb(new Error('Unsupported file type. Please upload a PDF or TXT file.'));
    }
    cb(null, true);
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

const buildSession = (title = 'New chat') => ({
  id: uuidv4(),
  title,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: []
});

const sanitizeMessage = (message) => String(message || '').trim();

app.get('/api/health', async (_req, res) => {
  try {
    const aiHealth = await axios.get(`${config.aiServiceUrl}/api/v1/health`, { timeout: 4000 }).catch(() => ({ data: { status: 'unavailable' } }));
    res.json({
      status: 'ok',
      express: 'running',
      mongo: 'not configured in this local academic build',
      aiService: aiHealth?.data?.status || 'unavailable',
      chroma: aiHealth?.data?.components?.chroma || 'unknown'
    });
  } catch (error) {
    res.status(503).json({ message: 'Health check failed', error: error.message });
  }
});

app.post('/api/sessions', (_req, res) => {
  const session = buildSession('New chat');
  saveSession(session);
  res.status(201).json({ success: true, data: session });
});

app.get('/api/sessions', (_req, res) => {
  const sessions = readSessions();
  res.json({ success: true, data: sessions });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = readSessions().find((item) => item.id === req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, data: session });
});

app.patch('/api/sessions/:id', (req, res) => {
  const sessions = readSessions();
  const session = sessions.find((item) => item.id === req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  session.title = req.body.title || session.title;
  session.updatedAt = new Date().toISOString();
  saveSession(session);
  res.json({ success: true, data: session });
});

app.delete('/api/sessions/:id', (req, res) => {
  const sessions = readSessions();
  const exists = sessions.some((item) => item.id === req.params.id);
  if (!exists) return res.status(404).json({ success: false, message: 'Session not found' });
  deleteSessionData(req.params.id);
  res.json({ success: true, message: 'Session deleted' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    const trimmed = sanitizeMessage(message);
    if (!trimmed) {
      return res.status(400).json({ success: false, message: 'Question is required.' });
    }

    let session = readSessions().find((item) => item.id === sessionId);
    if (!session) {
      session = buildSession('New chat');
      saveSession(session);
    }

    const userMessage = {
      id: uuidv4(),
      sessionId: session.id,
      role: 'USER',
      content: trimmed,
      timestamp: new Date().toISOString()
    };

    session.messages.push(userMessage);
    session.updatedAt = new Date().toISOString();
    saveSession(session);

    try {
      const response = await axios.post(`${config.aiServiceUrl}/api/v1/nlp/chat`, {
        question: trimmed,
        conversationHistory: session.messages.slice(-10).map((item) => ({ role: item.role, content: item.content }))
      }, { timeout: 20000 });

      const answer = response.data?.answer || 'I could not generate a reliable answer.';
      const sources = response.data?.sources || [];
      const assistantMessage = {
        id: uuidv4(),
        sessionId: session.id,
        role: 'ASSISTANT',
        content: answer,
        sources,
        timestamp: new Date().toISOString()
      };

      session.messages.push(assistantMessage);
      session.title = session.title && session.title !== 'New chat' ? session.title : `Chat ${session.messages.length}`;
      saveSession(session);

      return res.json({ success: true, data: { sessionId: session.id, messageId: assistantMessage.id, answer, sources, timestamp: assistantMessage.timestamp } });
    } catch (aiError) {
      const fallback = 'The AI service is currently unavailable. Please try again in a moment.';
      const assistantMessage = {
        id: uuidv4(),
        sessionId: session.id,
        role: 'ASSISTANT',
        content: fallback,
        sources: [],
        timestamp: new Date().toISOString(),
        error: true
      };
      session.messages.push(assistantMessage);
      saveSession(session);
      return res.json({
        success: true,
        data: {
          sessionId: session.id,
          messageId: assistantMessage.id,
          answer: fallback,
          sources: [],
          timestamp: assistantMessage.timestamp
        }
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to process the request.', error: error.message });
  }
});

app.post('/api/feedback', (req, res) => {
  const { messageId, rating, comment } = req.body || {};
  if (!messageId || !rating) {
    return res.status(400).json({ success: false, message: 'messageId and rating are required.' });
  }

  res.json({ success: true, data: { messageId, rating, comment: comment || '' } });
});

app.post('/api/admin/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A PDF or TXT document is required.' });
    }

    const payload = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      status: 'queued',
      uploadedAt: new Date().toISOString()
    };

    const docs = readDocuments();
    docs.unshift(payload);
    writeDocuments(docs);

    try {
      await axios.post(`${config.aiServiceUrl}/api/v1/documents/index`, { filePath: req.file.path, originalName: req.file.originalname, documentId: payload.filename }, { timeout: 15000 });
      payload.status = 'indexed';
      writeDocuments(docs);
    } catch (error) {
      payload.status = 'failed';
      payload.processingError = error.message;
      writeDocuments(docs);
    }

    return res.status(201).json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Document upload failed.', error: error.message });
  }
});

app.get('/api/admin/documents', (_req, res) => {
  res.json({ success: true, data: readDocuments() });
});

app.get('/api/admin/documents/:id', (req, res) => {
  const docs = readDocuments();
  const record = docs.find((item) => item.filename === req.params.id || item.originalName === req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, data: record });
});

app.delete('/api/admin/documents/:id', async (req, res) => {
  const docs = readDocuments();
  const record = docs.find((item) => item.filename === req.params.id || item.originalName === req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Document not found' });
  const keep = docs.filter((item) => item.filename !== req.params.id && item.originalName !== req.params.id);
  writeDocuments(keep);
  try {
    await axios.delete(`${config.aiServiceUrl}/api/v1/documents/${encodeURIComponent(req.params.id)}`, { timeout: 15000 });
  } catch (_error) {
    // AI service may already be down; the local metadata is still removed.
  }
  res.json({ success: true, message: 'Document deleted' });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  res.status(500).json({ success: false, message: 'Internal server error', error: error.message || 'Unknown error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`College FAQ server listening on http://localhost:${config.port}`);
  });
}

export default app;
