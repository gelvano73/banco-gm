import { randomUUID } from 'node:crypto';
import {
  addExtrato,
  db,
  toPublicPixKey,
  toPublicPixTransaction,
  type PixKeyRow,
  type PixKeyType,
  type PixTransactionRow,
} from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { sanitizeCpf, isValidCpf } from '../utils/cpf.js';
import { findClientById } from './clientService.js';
import { findAccountById } from './accountService.js';

function normalizePixValue(type: PixKeyType, value: string): string {
  if (type === 'cpf') return sanitizeCpf(value);
  if (type === 'phone') return value.replace(/\D/g, '');
  if (type === 'email') return value.toLowerCase().trim();
  return value.trim();
}

function findPixKeyByValue(value: string): PixKeyRow | undefined {
  return db.prepare('SELECT * FROM pix WHERE value = ?').get(value) as PixKeyRow | undefined;
}

function findPixKeyById(id: string): PixKeyRow | undefined {
  return db.prepare('SELECT * FROM pix WHERE id = ?').get(id) as PixKeyRow | undefined;
}

function findPixKeyByClientAndType(clientId: string, type: PixKeyType): PixKeyRow | undefined {
  return db
    .prepare('SELECT * FROM pix WHERE client_id = ? AND type = ?')
    .get(clientId, type) as PixKeyRow | undefined;
}

export function listPixKeys(clientId: string) {
  const rows = db
    .prepare('SELECT * FROM pix WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId) as PixKeyRow[];
  return rows.map(toPublicPixKey);
}

export function createPixKey(clientId: string, accountId: string, type: PixKeyType, rawValue?: string) {
  const client = findClientById(clientId);
  if (!client) throw new AppError('Cliente não encontrado.', 404);

  const account = findAccountById(accountId);
  if (!account || account.client_id !== clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  if (account.status !== 'active') {
    throw new AppError('Só é possível vincular chave PIX a conta ativa.', 400);
  }

  if (findPixKeyByClientAndType(clientId, type)) {
    throw new AppError('Você já possui uma chave PIX deste tipo.', 409);
  }

  let value: string;
  if (type === 'cpf') {
    value = client.cpf;
    if (!isValidCpf(value)) throw new AppError('CPF do cliente inválido.', 400);
  } else if (type === 'email') {
    value = client.email.toLowerCase();
  } else if (type === 'phone') {
    value = client.phone.replace(/\D/g, '');
    if (value.length < 10) throw new AppError('Telefone do cliente inválido.', 400);
  } else if (type === 'random') {
    value = randomUUID();
  } else {
    throw new AppError('Tipo de chave inválido.', 400);
  }

  // valor customizado só faz sentido se no futuro liberarmos; por enquanto ignora rawValue para cpf/phone/email
  void rawValue;
  value = normalizePixValue(type, value);

  if (findPixKeyByValue(value)) {
    throw new AppError('Esta chave PIX já está em uso.', 409);
  }

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO pix (id, client_id, account_id, type, value)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, clientId, accountId, type, value);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.toLowerCase().includes('unique')) {
      throw new AppError('Chave PIX já cadastrada.', 409);
    }
    throw err;
  }

  const key = findPixKeyById(id);
  if (!key) throw new AppError('Falha ao criar chave PIX.', 500);
  return toPublicPixKey(key);
}

export function deletePixKey(clientId: string, keyId: string) {
  const key = findPixKeyById(keyId);
  if (!key || key.client_id !== clientId) {
    throw new AppError('Chave PIX não encontrada.', 404);
  }
  db.prepare('DELETE FROM pix WHERE id = ?').run(keyId);
  return { message: 'Chave PIX removida.' };
}

/** Consulta pública limitada de uma chave PIX */
export function lookupPixKey(rawValue: string) {
  const candidates = [
    rawValue.trim(),
    sanitizeCpf(rawValue),
    rawValue.replace(/\D/g, ''),
    rawValue.toLowerCase().trim(),
  ];

  let key: PixKeyRow | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    key = findPixKeyByValue(candidate);
    if (key) break;
  }

  if (!key) throw new AppError('Chave PIX não encontrada.', 404);

  const owner = findClientById(key.client_id);
  const account = findAccountById(key.account_id);
  if (!owner || !account) throw new AppError('Chave PIX inválida.', 404);

  return {
    type: key.type,
    value: key.value,
    typeLabel: toPublicPixKey(key).typeLabel,
    ownerName: maskName(owner.full_name),
    agency: account.agency,
    accountNumber: maskAccount(account.number),
    accountType: account.type,
    accountStatus: account.status,
  };
}

function maskName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return `${parts[0][0]}***`;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function maskAccount(number: string) {
  if (number.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, number.length - 4))}${number.slice(-4)}`;
}

export function transferPix(input: {
  clientId: string;
  fromAccountId: string;
  pixKey: string;
  amount: number;
  description?: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError('Valor do PIX inválido.', 400);
  }

  const amountCents = Math.round(input.amount * 100);
  if (amountCents <= 0) throw new AppError('Valor do PIX inválido.', 400);

  const fromAccount = findAccountById(input.fromAccountId);
  if (!fromAccount || fromAccount.client_id !== input.clientId) {
    throw new AppError('Conta de origem não encontrada.', 404);
  }
  if (fromAccount.status !== 'active') {
    throw new AppError('Conta de origem precisa estar ativa.', 400);
  }

  const lookupCandidates = [
    input.pixKey.trim(),
    sanitizeCpf(input.pixKey),
    input.pixKey.replace(/\D/g, ''),
    input.pixKey.toLowerCase().trim(),
  ];

  let targetKey: PixKeyRow | undefined;
  for (const candidate of lookupCandidates) {
    if (!candidate) continue;
    targetKey = findPixKeyByValue(candidate);
    if (targetKey) break;
  }

  if (!targetKey) throw new AppError('Chave PIX de destino não encontrada.', 404);

  const toAccount = findAccountById(targetKey.account_id);
  if (!toAccount) throw new AppError('Conta de destino inválida.', 400);
  if (toAccount.status !== 'active') {
    throw new AppError('Conta de destino está indisponível para receber PIX.', 400);
  }
  if (toAccount.id === fromAccount.id) {
    throw new AppError('Não é possível transferir PIX para a mesma conta.', 400);
  }

  if (fromAccount.balance_cents < amountCents) {
    throw new AppError('Saldo insuficiente para realizar o PIX.', 400);
  }

  const txId = randomUUID();
  const endToEndId = `E${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 20)}`.slice(0, 32);

  db.exec('BEGIN');
  try {
    const debit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents - ?, updated_at = datetime('now')
      WHERE id = ? AND balance_cents >= ? AND status = 'active'
    `).run(amountCents, fromAccount.id, amountCents);

    if (debit.changes !== 1) {
      throw new AppError('Saldo insuficiente para realizar o PIX.', 400);
    }

    const credit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents + ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(amountCents, toAccount.id);

    if (credit.changes !== 1) {
      throw new AppError('Conta de destino está indisponível para receber PIX.', 400);
    }

    db.prepare(`
      INSERT INTO transferencias (
        id, type, from_account_id, from_client_id, to_account_id, to_client_id,
        amount_cents, description, status, pix_key, end_to_end_id
      ) VALUES (?, 'pix', ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      txId,
      fromAccount.id,
      fromAccount.client_id,
      toAccount.id,
      toAccount.client_id,
      amountCents,
      input.description?.trim() || null,
      targetKey.value,
      endToEndId,
    );

    addExtrato({
      clientId: fromAccount.client_id,      accountId: fromAccount.id,
      tipo: 'pix',
      direcao: 'out',
      amountCents,
      descricao: input.description?.trim() || `PIX enviado · ${targetKey.value}`,
      referencia: txId,
    });
    addExtrato({
      clientId: toAccount.client_id,
      accountId: toAccount.id,
      tipo: 'pix',
      direcao: 'in',
      amountCents,
      descricao: input.description?.trim() || `PIX recebido · ${targetKey.value}`,
      referencia: txId,
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const row = db.prepare(`SELECT * FROM transferencias WHERE id = ?`).get(txId) as {
    id: string;
    end_to_end_id: string;
    from_account_id: string;
    to_account_id: string;
    from_client_id: string;
    to_client_id: string;
    amount_cents: number;
    pix_key: string;
    description: string | null;
    status: 'completed' | 'failed';
    created_at: string;
  };

  return toPublicPixTransaction(
    {
      id: row.id,
      end_to_end_id: row.end_to_end_id,
      from_account_id: row.from_account_id,
      to_account_id: row.to_account_id,
      from_client_id: row.from_client_id,
      to_client_id: row.to_client_id,
      amount_cents: row.amount_cents,
      pix_key: row.pix_key,
      description: row.description,
      status: row.status,
      created_at: row.created_at,
    },
    { direction: 'out', viewerClientId: input.clientId },
  );
}

export function listPixTransactions(clientId: string) {
  const rows = db
    .prepare(`
      SELECT id, end_to_end_id, from_account_id, to_account_id, from_client_id, to_client_id,
             amount_cents, pix_key, description, status, created_at
      FROM transferencias
      WHERE type = 'pix' AND (from_client_id = ? OR to_client_id = ?)
      ORDER BY created_at DESC
    `)
    .all(clientId, clientId) as PixTransactionRow[];

  return rows.map((row) => toPublicPixTransaction(row, { viewerClientId: clientId }));
}

export function getPixTransaction(clientId: string, transactionId: string) {
  const row = db
    .prepare(`
      SELECT id, end_to_end_id, from_account_id, to_account_id, from_client_id, to_client_id,
             amount_cents, pix_key, description, status, created_at
      FROM transferencias
      WHERE type = 'pix' AND (id = ? OR end_to_end_id = ?)
    `)
    .get(transactionId, transactionId) as PixTransactionRow | undefined;

  if (!row || (row.from_client_id !== clientId && row.to_client_id !== clientId)) {
    throw new AppError('Transação PIX não encontrada.', 404);
  }

  return toPublicPixTransaction(row, { viewerClientId: clientId });
}
