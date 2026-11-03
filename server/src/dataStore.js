import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const sessionPath = path.join(dataDir, 'sessions.json');
const documentsPath = path.join(dataDir, 'documents.json');

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const ensureFile = (filePath, fallback = []) => {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
};

export const readSessions = () => {
  ensureFile(sessionPath, []);
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
};

export const writeSessions = (sessions) => {
  ensureDataDir();
  fs.writeFileSync(sessionPath, JSON.stringify(sessions, null, 2));
};

export const readDocuments = () => {
  ensureFile(documentsPath, []);
  return JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
};

export const writeDocuments = (documents) => {
  ensureDataDir();
  fs.writeFileSync(documentsPath, JSON.stringify(documents, null, 2));
};

export const saveSession = (session) => {
  const sessions = readSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) sessions[existingIndex] = session;
  else sessions.unshift(session);
  writeSessions(sessions);
  return session;
};

export const deleteSessionData = (sessionId) => {
  const sessions = readSessions().filter((s) => s.id !== sessionId);
  writeSessions(sessions);
};
