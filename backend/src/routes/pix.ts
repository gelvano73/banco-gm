import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  createPixKey,
  deletePixKey,
  getPixTransaction,
  listPixKeys,
  listPixTransactions,
  lookupPixKey,
  transferPix,
} from '../services/pixService.js';

export const pixRouter = Router();

pixRouter.use(authMiddleware);

const createKeySchema = z.object({
  accountId: z.string().uuid('Conta inválida.'),
  type: z.enum(['cpf', 'phone', 'email', 'random'], {
    message: 'Tipo de chave deve ser cpf, phone, email ou random.',
  }),
});

const transferSchema = z.object({
  fromAccountId: z.string().uuid('Conta de origem inválida.'),
  pixKey: z.string().min(3, 'Informe a chave PIX de destino.'),
  amount: z.number().positive('Valor deve ser maior que zero.'),
  description: z.string().max(140).optional(),
});

pixRouter.get('/keys', (req: AuthRequest, res) => {
  return res.json({ keys: listPixKeys(req.clientId!) });
});

pixRouter.post('/keys', (req: AuthRequest, res) => {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const key = createPixKey(req.clientId!, parsed.data.accountId, parsed.data.type);
    return res.status(201).json({
      message: 'Chave PIX criada com sucesso.',
      key,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar chave PIX.' });
  }
});

pixRouter.delete('/keys/:id', (req: AuthRequest, res) => {
  try {
    const result = deletePixKey(req.clientId!, String(req.params.id));
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao remover chave PIX.' });
  }
});

pixRouter.get('/lookup/:value', (req: AuthRequest, res) => {
  try {
    const value = decodeURIComponent(String(req.params.value));
    const result = lookupPixKey(value);
    return res.json({ pix: result });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar chave PIX.' });
  }
});

function handlePixEnviar(req: AuthRequest, res: import('express').Response) {
  try {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const transaction = transferPix({
      clientId: req.clientId!,
      fromAccountId: parsed.data.fromAccountId,
      pixKey: parsed.data.pixKey,
      amount: parsed.data.amount,
      description: parsed.data.description,
    });

    return res.status(201).json({
      message: 'PIX realizado com sucesso.',
      transaction,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao transferir PIX.' });
  }
}

pixRouter.post('/enviar', handlePixEnviar);
pixRouter.post('/transfer', handlePixEnviar);
pixRouter.get('/transactions', (req: AuthRequest, res) => {
  return res.json({ transactions: listPixTransactions(req.clientId!) });
});

pixRouter.get('/transactions/:id', (req: AuthRequest, res) => {
  try {
    const transaction = getPixTransaction(req.clientId!, String(req.params.id));
    return res.json({ transaction });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar PIX.' });
  }
});
