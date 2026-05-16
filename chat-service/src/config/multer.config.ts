// src/config/multer.config.ts
import { memoryStorage } from 'multer';

export const multerConfig = {
  storage: memoryStorage(),          // keep in-memory
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — adjust as you like
};
