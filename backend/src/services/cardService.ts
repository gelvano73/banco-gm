import { randomInt, randomUUID } from 'node:crypto';
import { db, toPublicCard, type CardRow, type CardType } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { findAccountById } from './accountService.js';
import { findClientById } from './clientService.js';

const CARD_BIN = '516230';

function generateCvv(): string {
  return String(randomInt(100, 1000));
}

function luhnCheckDigit(partial: string): number {
  let sum = 0;
  let doubleDigit = true;
  for (let i = partial.length - 1; i >= 0; i -= 1) {
    let n = Number(partial[i]);
    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    doubleDigit = !doubleDigit;
  }
  return (10 - (sum % 10)) % 10;
}

function generateCardNumber(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const body = `${CARD_BIN}${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`.slice(0, 15);
    const number = `${body}${luhnCheckDigit(body)}`;
    const exists = db.prepare('SELECT id FROM cartoes WHERE number = ?').get(number);
    if (!exists) return number;
  }
  throw new AppError('Não foi possível gerar número de cartão.', 500);
}

function findCardById(id: string): CardRow | undefined {
  return db.prepare('SELECT * FROM cartoes WHERE id = ?').get(id) as CardRow | undefined;
}

function findCardByAccountAndType(accountId: string, type: CardType): CardRow | undefined {
  return db
    .prepare('SELECT * FROM cartoes WHERE account_id = ? AND type = ?')
    .get(accountId, type) as CardRow | undefined;
}

export function listCards(clientId: string) {
  const rows = db
    .prepare('SELECT * FROM cartoes WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId) as CardRow[];
  return rows.map(toPublicCard);
}

export async function createCard(input: {
  clientId: string;
  accountId: string;
  type: CardType;
  pin: string;
}) {
  if (input.type !== 'virtual' && input.type !== 'physical') {
    throw new AppError('Tipo de cartão inválido.', 400);
  }

  if (!/^\d{4}$/.test(input.pin)) {
    throw new AppError('A senha do cartão deve ter 4 dígitos.', 400);
  }

  const client = findClientById(input.clientId);
  if (!client) throw new AppError('Cliente não encontrado.', 404);

  const account = findAccountById(input.accountId);
  if (!account || account.client_id !== input.clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  if (account.status !== 'active') {
    throw new AppError('Só é possível emitir cartão para conta ativa.', 400);
  }

  if (findCardByAccountAndType(input.accountId, input.type)) {
    const label = input.type === 'virtual' ? 'virtual' : 'físico';
    throw new AppError(`Esta conta já possui um cartão ${label}.`, 409);
  }

  const now = new Date();
  const expirationMonth = now.getMonth() + 1;
  const expirationYear = now.getFullYear() + 4;
  const id = randomUUID();
  const number = generateCardNumber();
  const cvv = generateCvv();
  const pinHash = await hashPassword(input.pin);

  try {
    db.prepare(`
      INSERT INTO cartoes (
        id, client_id, account_id, type, holder_name, number, cvv,
        expiration_month, expiration_year, pin_hash, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      id,
      input.clientId,
      input.accountId,
      input.type,
      client.full_name.toUpperCase(),
      number,
      cvv,
      expirationMonth,
      expirationYear,
      pinHash,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.toLowerCase().includes('unique')) {
      throw new AppError('Cartão deste tipo já existe para a conta.', 409);
    }
    throw err;
  }

  const card = findCardById(id);
  if (!card) throw new AppError('Falha ao criar cartão.', 500);
  return toPublicCard(card);
}

export function setCardStatus(clientId: string, cardId: string, status: 'active' | 'blocked') {
  const card = findCardById(cardId);
  if (!card || card.client_id !== clientId) {
    throw new AppError('Cartão não encontrado.', 404);
  }

  if (card.status === status) {
    throw new AppError(
      status === 'blocked' ? 'Cartão já está bloqueado.' : 'Cartão já está ativo.',
      400,
    );
  }

  db.prepare(`
    UPDATE cartoes SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, cardId);

  const updated = findCardById(cardId);
  if (!updated) throw new AppError('Falha ao atualizar cartão.', 500);
  return toPublicCard(updated);
}

export async function changeCardPin(
  clientId: string,
  cardId: string,
  currentPin: string,
  newPin: string,
) {
  if (!/^\d{4}$/.test(newPin)) {
    throw new AppError('A nova senha deve ter 4 dígitos.', 400);
  }

  const card = findCardById(cardId);
  if (!card || card.client_id !== clientId) {
    throw new AppError('Cartão não encontrado.', 404);
  }

  const ok = await comparePassword(currentPin, card.pin_hash);
  if (!ok) {
    throw new AppError('Senha atual do cartão incorreta.', 401);
  }

  const pinHash = await hashPassword(newPin);
  db.prepare(`
    UPDATE cartoes SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).run(pinHash, cardId);

  return { message: 'Senha do cartão alterada com sucesso.' };
}
