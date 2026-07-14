import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  getTransfer,
  listAuditLogs,
  listTransfers,
  transferInternal,
  transferTed,
} from '../services/transferService.js';

export const transfersRouter = Router();

transfersRouter.use(authMiddleware);

const internalSchema = z.object({
  fromAccountId: z.string().uuid('Conta de origem inválida.'),
  toAgency: z.string().min(1, 'Informe a agência de destino.'),
  toAccountNumber: z.string().min(3, 'Informe o número da conta de destino.'),
  amount: z.number().positive('Valor deve ser maior que zero.'),
  description: z.string().max(140).optional(),
});

const tedSchema = z.object({
  fromAccountId: z.string().uuid('Conta de origem inválida.'),
  bankCode: z.string().min(1, 'Informe o código do banco.'),
  agency: z.string().min(1, 'Informe a agência.'),
  accountNumber: z.string().min(3, 'Informe a conta.'),
  recipientName: z.string().min(3, 'Informe o nome do destinatário.'),
  recipientDocument: z.string().min(11, 'Informe o CPF/CNPJ do destinatário.'),
  amount: z.number().positive('Valor deve ser maior que zero.'),
  description: z.string().max(140).optional(),
});

transfersRouter.get('/', (req: AuthRequest, res) => {
  return res.json({ transfers: listTransfers(req.clientId!) });
});

transfersRouter.get('/audit', (req: AuthRequest, res) => {
  return res.json({ logs: listAuditLogs(req.clientId!) });
});

transfersRouter.get('/:id', (req: AuthRequest, res) => {
  try {
    const transfer = getTransfer(req.clientId!, String(req.params.id));
    return res.json({ transfer });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar transferência.' });
  }
});

transfersRouter.post('/internal', (req: AuthRequest, res) => {
  try {
    const parsed = internalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const transfer = transferInternal({
      clientId: req.clientId!,
      ...parsed.data,
    });

    return res.status(201).json({
      message: 'Transferência interna realizada com sucesso.',
      transfer,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro na transferência interna.' });
  }
});

transfersRouter.post('/ted', (req: AuthRequest, res) => {
  try {
    const parsed = tedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const transfer = transferTed({
      clientId: req.clientId!,
      ...parsed.data,
    });

    return res.status(201).json({
      message: 'TED realizada com sucesso.',
      transfer,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro na TED.' });
  }
});
