import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { findAdminById } from '../services/adminService.js';

export type AuthRequest = Request & {
  clientId?: string;
  clientEmail?: string;
  clientRole?: 'client' | 'admin';
};

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não informado.' });
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.clientId = payload.sub;
    req.clientEmail = payload.email;
    req.clientRole = payload.role || 'client';
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.clientId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  const admin = findAdminById(req.clientId);
  if (!admin || !admin.active) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  req.clientRole = 'admin';
  return next();
}
