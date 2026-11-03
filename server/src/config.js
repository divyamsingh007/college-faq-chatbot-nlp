import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  jwtSecret: process.env.JWT_SECRET || 'local-dev-secret',
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024),
  sessionStorePath: process.env.SESSION_STORE_PATH || './data/sessions.json',
  uploadDir: process.env.UPLOAD_DIR || './uploads'
};
