import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  changeCardPin,
  createCard,
  listCards,
  setCardStatus,
} from '../services/cardService.js';

export const cardsRouter = Router();

cardsRouter.use(authMiddleware);

const createSchema = z.object({
  accountId: z.string().uuid('Conta inválida.'),
  type: z.enum(['virtual', 'physical'], {
    message: 'Tipo deve ser virtual ou physical.',
  }),
  pin: z.string().regex(/^\d{4}$/, 'A senha deve ter 4 dígitos.'),
});

const pinSchema = z.object({
  currentPin: z.string().regex(/^\d{4}$/, 'Senha atual inválida.'),
  newPin: z.string().regex(/^\d{4}$/, 'Nova senha deve ter 4 dígitos.'),
});

cardsRouter.get('/', (req: AuthRequest, res) => {
  return res.json({ cards: listCards(req.clientId!) });
});

cardsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const card = await createCard({
      clientId: req.clientId!,
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      pin: parsed.data.pin,
    });

    return res.status(201).json({
      message:
        parsed.data.type === 'virtual'
          ? 'Cartão virtual criado com sucesso.'
          : 'Cartão físico solicitado com sucesso.',
      card,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar cartão.' });
  }
});

cardsRouter.post('/:id/block', (req: AuthRequest, res) => {
  try {
    const card = setCardStatus(req.clientId!, String(req.params.id), 'blocked');
    return res.json({ message: 'Cartão bloqueado.', card });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao bloquear cartão.' });
  }
});

cardsRouter.post('/:id/unblock', (req: AuthRequest, res) => {
  try {
    const card = setCardStatus(req.clientId!, String(req.params.id), 'active');
    return res.json({ message: 'Cartão desbloqueado.', card });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao desbloquear cartão.' });
  }
});

cardsRouter.patch('/:id/pin', async (req: AuthRequest, res) => {
  try {
    const parsed = pinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Dados inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await changeCardPin(
      req.clientId!,
      String(req.params.id),
      parsed.data.currentPin,
      parsed.data.newPin,
    );

    return res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro ao alterar senha do cartão.' });
  }
});
