import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  applyInvestment,
  listInvestments,
  listProducts,
  simulateInvestment,
} from '../services/investmentService.js';

export const investmentsRouter = Router();

investmentsRouter.use(authMiddleware);

const productEnum = z.enum(['cdb', 'savings', 'treasury'], {
  message: 'Produto deve ser cdb, savings ou treasury.',
});

const simulateSchema = z.object({
  product: productEnum,
  amount: z.number().positive('Informe o valor da aplicação.'),
  termMonths: z.number().int().positive().max(360).optional(),
});

const applySchema = z.object({
  accountId: z.string().uuid('Conta inválida.'),
  product: productEnum,
  amount: z.number().positive('Informe o valor da aplicação.'),
  termMonths: z.number().int().positive().max(360).optional(),
});

investmentsRouter.get('/products', (_req, res) => {
  return res.json({ products: listProducts() });
});

investmentsRouter.post('/simulate', (req: AuthRequest, res) => {
  try {
    const parsed = simulateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const simulation = simulateInvestment(parsed.data);
    return res.json({ simulation });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao simular investimento.' });
  }
});

investmentsRouter.get('/', (req: AuthRequest, res) => {
  return res.json({ investments: listInvestments(req.clientId!) });
});

investmentsRouter.post('/apply', (req: AuthRequest, res) => {
  try {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = applyInvestment({
      clientId: req.clientId!,
      ...parsed.data,
    });

    return res.status(201).json({
      message: 'Aplicação realizada com sucesso.',
      ...result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao aplicar investimento.' });
  }
});
