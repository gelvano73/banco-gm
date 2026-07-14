import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  approveLoan,
  getLoan,
  listLoans,
  LOAN_DEFAULTS,
  requestLoan,
  simulateLoan,
} from '../services/loanService.js';

export const loansRouter = Router();

loansRouter.use(authMiddleware);

const simulateSchema = z.object({
  principal: z.number().positive().optional(),
  monthlyRate: z.number().min(0).max(1).optional(),
  termMonths: z.number().int().positive().max(120).optional(),
});

const requestSchema = z.object({
  accountId: z.string().uuid('Conta inválida.'),
});

loansRouter.get('/product', (_req, res) => {
  return res.json({
    product: {
      name: 'G&M Crédito Pessoal',
      principal: LOAN_DEFAULTS.principal,
      monthlyRatePercent: LOAN_DEFAULTS.monthlyRate * 100,
      termMonths: LOAN_DEFAULTS.termMonths,
    },
    simulation: simulateLoan(),
  });
});

loansRouter.post('/simulate', (req: AuthRequest, res) => {
  try {
    const parsed = simulateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const simulation = simulateLoan(parsed.data);
    return res.json({ simulation });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao simular empréstimo.' });
  }
});

loansRouter.get('/', (req: AuthRequest, res) => {
  return res.json({ loans: listLoans(req.clientId!) });
});

loansRouter.post('/request', (req: AuthRequest, res) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const loan = requestLoan(req.clientId!, parsed.data.accountId);
    return res.status(201).json({
      message: 'Solicitação de empréstimo enviada para análise.',
      loan,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao solicitar empréstimo.' });
  }
});

loansRouter.post('/:id/approve', (req: AuthRequest, res) => {
  try {
    const loan = approveLoan(req.clientId!, String(req.params.id));
    return res.json({
      message: 'Empréstimo aprovado. Valor creditado na conta.',
      loan,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao aprovar empréstimo.' });
  }
});

loansRouter.get('/:id', (req: AuthRequest, res) => {
  try {
    const loan = getLoan(req.clientId!, String(req.params.id));
    return res.json({ loan });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar empréstimo.' });
  }
});
