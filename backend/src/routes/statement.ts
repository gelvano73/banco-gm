import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { findClientById } from '../services/clientService.js';
import {
  getStatement,
  parsePeriod,
  statementToCsv,
  statementToPdf,
} from '../services/statementService.js';

export const statementRouter = Router();

statementRouter.use(authMiddleware);

statementRouter.get('/', (req: AuthRequest, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    parsePeriod(from, to);
    const items = getStatement(req.clientId!, from, to);
    return res.json({ from: from ?? null, to: to ?? null, items, count: items.length });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar extrato.' });
  }
});

statementRouter.get('/csv', (req: AuthRequest, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    parsePeriod(from, to);
    const items = getStatement(req.clientId!, from, to);
    const csv = statementToCsv(items);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="extrato-gm-bank.csv"');
    return res.send(csv);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao exportar CSV.' });
  }
});

statementRouter.get('/pdf', (req: AuthRequest, res) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    parsePeriod(from, to);
    const client = findClientById(req.clientId!);
    const items = getStatement(req.clientId!, from, to);
    const pdf = statementToPdf(items, client?.full_name || 'Cliente');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="extrato-gm-bank.pdf"');
    return res.send(pdf);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao exportar PDF.' });
  }
});
