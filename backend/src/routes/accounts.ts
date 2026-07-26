import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import {
  createAccount,
  depositToAccount,
  getClientAccount,
  listAccountsByClient,
  updateAccountStatus,
} from '../services/accountService.js';
import { AppError } from '../utils/errors.js';
import { toPublicAccount } from '../db/database.js';

export const accountsRouter = Router();

accountsRouter.use(authMiddleware);

const createSchema = z.object({
  type: z.enum(['checking', 'savings'], {
    message: 'Tipo deve ser checking (corrente) ou savings (poupança).',
  }),
});

const statusSchema = z.object({
  status: z.enum(['active', 'blocked', 'closed'], {
    message: 'Status deve ser active, blocked ou closed.',
  }),
});

const depositSchema = z.object({
  amount: z.number().positive('Valor deve ser maior que zero.'),
});

accountsRouter.get('/', (req: AuthRequest, res) => {
  const accounts = listAccountsByClient(req.clientId!).map(toPublicAccount);
  return res.json({ accounts });
});

accountsRouter.post('/', (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const account = createAccount(req.clientId!, parsed.data.type);
    return res.status(201).json({
      message:
        parsed.data.type === 'checking'
          ? 'Conta corrente criada com sucesso.'
          : 'Conta poupança criada com sucesso.',
      account,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

accountsRouter.get('/:id', (req: AuthRequest, res) => {
  try {
    const account = getClientAccount(req.clientId!, String(req.params.id));
    return res.json({ account });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar conta.' });
  }
});

accountsRouter.patch('/:id/status', (req: AuthRequest, res) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const account = updateAccountStatus(req.clientId!, String(req.params.id), parsed.data.status);
    return res.json({
      message: 'Status da conta atualizado.',
      account,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

accountsRouter.post('/:id/deposit', (req: AuthRequest, res) => {
  try {
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const account = depositToAccount(req.clientId!, String(req.params.id), parsed.data.amount);
    return res.json({
      message: 'Depósito realizado com sucesso.',
      account,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao depositar.' });
  }
});
