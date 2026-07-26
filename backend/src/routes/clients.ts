import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  addDocument,
  findClientById,
  listDocuments,
} from '../services/clientService.js';
import { toPublicClient } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato inválido. Use JPG, PNG ou PDF.'));
    }
    return cb(null, true);
  },
});

export const clientsRouter = Router();

clientsRouter.use(authMiddleware);

clientsRouter.get('/me', (req: AuthRequest, res) => {
  const client = findClientById(req.clientId!);
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }
  return res.json({ client: toPublicClient(client) });
});

clientsRouter.get('/me/documents', (req: AuthRequest, res) => {
  const docs = listDocuments(req.clientId!).map((d) => ({
    id: d.id,
    type: d.type,
    originalName: d.original_name,
    mimeType: d.mime_type,
    size: d.size,
    uploadedAt: d.uploaded_at,
  }));
  return res.json({ documents: docs });
});

clientsRouter.post('/me/documents', (req: AuthRequest, res) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Falha no upload.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

    const type = String(req.body.type || 'identity').slice(0, 40);

    const document = addDocument({
      clientId: req.clientId!,
      type,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    return res.status(201).json({
      message: 'Documento enviado com sucesso.',
      document: {
        id: document.id,
        type: document.type,
        originalName: document.original_name,
        mimeType: document.mime_type,
        size: document.size,
        uploadedAt: document.uploaded_at,
      },
    });
  });
});
