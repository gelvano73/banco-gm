import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, adminMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { handleLogin, handleRegister } from './auth.js';
import { transferPix } from '../services/pixService.js';
import { transferInternal, transferTed } from '../services/transferService.js';
import { requestLoan } from '../services/loanService.js';
import { getAdminDashboard } from '../services/adminService.js';
import {
  getStatement,
  parsePeriod,
} from '../services/statementService.js';

/**
 * Contrato de rotas em português (projeto):
 * POST /clientes | POST /login | POST /contas | POST /pix/enviar
 * POST /transferencia | POST /emprestimo | GET /extrato | GET /dashboard
 */
export const contratoRouter = Router();

contratoRouter.post('/clientes', handleRegister);
contratoRouter.post('/login', handleLogin);

const pixEnviarSchema = z.object({
  fromAccountId: z.string().uuid('Conta de origem inválida.'),
  pixKey: z.string().min(3, 'Informe a chave PIX de destino.'),
  amount: z.number().positive('Valor deve ser maior que zero.'),
  description: z.string().max(140).optional(),
});

contratoRouter.post('/pix/enviar', authMiddleware, (req: AuthRequest, res) => {
  try {
    const parsed = pixEnviarSchema.safeParse(req.body);
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
});

const transferenciaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('internal'),
    fromAccountId: z.string().uuid('Conta de origem inválida.'),
    toAgency: z.string().min(1, 'Informe a agência de destino.'),
    toAccountNumber: z.string().min(3, 'Informe o número da conta de destino.'),
    amount: z.number().positive('Valor deve ser maior que zero.'),
    description: z.string().max(140).optional(),
  }),
  z.object({
    type: z.literal('ted'),
    fromAccountId: z.string().uuid('Conta de origem inválida.'),
    bankCode: z.string().min(1, 'Informe o código do banco.'),
    agency: z.string().min(1, 'Informe a agência.'),
    accountNumber: z.string().min(3, 'Informe a conta.'),
    recipientName: z.string().min(3, 'Informe o nome do destinatário.'),
    recipientDocument: z.string().min(11, 'Informe o CPF/CNPJ do destinatário.'),
    amount: z.number().positive('Valor deve ser maior que zero.'),
    description: z.string().max(140).optional(),
  }),
]);

contratoRouter.post('/transferencia', authMiddleware, (req: AuthRequest, res) => {
  try {
    const parsed = transferenciaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos. Informe type: "internal" ou "ted".',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    if (parsed.data.type === 'internal') {
      const { type: _t, ...input } = parsed.data;
      const transfer = transferInternal({ clientId: req.clientId!, ...input });
      return res.status(201).json({
        message: 'Transferência interna realizada com sucesso.',
        transfer,
      });
    }

    const { type: _t, ...input } = parsed.data;
    const transfer = transferTed({ clientId: req.clientId!, ...input });
    return res.status(201).json({
      message: 'TED realizada com sucesso.',
      transfer,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro na transferência.' });
  }
});

const emprestimoSchema = z.object({
  accountId: z.string().uuid('Conta inválida.'),
});

contratoRouter.post('/emprestimo', authMiddleware, (req: AuthRequest, res) => {
  try {
    const parsed = emprestimoSchema.safeParse(req.body);
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

contratoRouter.get('/extrato', authMiddleware, (req: AuthRequest, res) => {
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

contratoRouter.get('/dashboard', authMiddleware, adminMiddleware, (_req: AuthRequest, res) => {
  return res.json({ dashboard: getAdminDashboard() });
});
