import { randomUUID } from 'node:crypto';
import {
  addExtrato,
  db,
  toPublicAccount,
  type AccountRow,
  type AccountStatus,
  type AccountType,
} from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { findClientById } from './clientService.js';

/** Agência padrão do G&M Bank (banco digital) */
export const DEFAULT_AGENCY = '0001';

function calcCheckDigit(base: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    sum += Number(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod === 0 || mod === 1 ? 0 : 11 - mod;
}

/** Gera próximo número de conta no formato 00000000-0 */
function nextAccountNumber(): string {
  const seq = db
    .prepare("SELECT value FROM contas_sequencias WHERE name = 'account_number'")
    .get() as { value: number } | undefined;

  const current = seq?.value ?? 10000000;
  const next = current + 1;

  db.prepare("UPDATE contas_sequencias SET value = ? WHERE name = 'account_number'").run(next);

  const base = String(next).padStart(8, '0');
  return `${base}-${calcCheckDigit(base)}`;
}

export function findAccountById(id: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM contas WHERE id = ?').get(id) as AccountRow | undefined;
}

export function listAccountsByClient(clientId: string): AccountRow[] {
  return db
    .prepare('SELECT * FROM contas WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId) as AccountRow[];
}

function findAccountByClientAndType(clientId: string, type: AccountType): AccountRow | undefined {
  return db
    .prepare('SELECT * FROM contas WHERE client_id = ? AND type = ?')
    .get(clientId, type) as AccountRow | undefined;
}

export function createAccount(clientId: string, type: AccountType) {
  if (!findClientById(clientId)) {
    throw new AppError('Cliente não encontrado.', 404);
  }

  if (type !== 'checking' && type !== 'savings') {
    throw new AppError('Tipo de conta inválido. Use checking ou savings.', 400);
  }

  if (findAccountByClientAndType(clientId, type)) {
    const label = type === 'checking' ? 'corrente' : 'poupança';
    throw new AppError(
      `Já existe uma conta ${label} para este CPF. Cada cliente pode ter apenas uma conta corrente e uma poupança.`,
      409,
    );
  }

  const id = randomUUID();
  const number = nextAccountNumber();

  try {
    db.prepare(`
      INSERT INTO contas (id, client_id, type, agency, number, balance_cents, status)
      VALUES (?, ?, ?, ?, ?, 0, 'active')
    `).run(id, clientId, type, DEFAULT_AGENCY, number);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE') || message.includes('unique')) {
      const label = type === 'checking' ? 'corrente' : 'poupança';
      throw new AppError(
        `Já existe uma conta ${label} para este CPF. Cada cliente pode ter apenas uma conta corrente e uma poupança.`,
        409,
      );
    }
    throw err;
  }

  const account = findAccountById(id);
  if (!account) throw new AppError('Falha ao criar conta.', 500);

  return toPublicAccount(account);
}

export function getClientAccount(clientId: string, accountId: string) {
  const account = findAccountById(accountId);
  if (!account || account.client_id !== clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  return toPublicAccount(account);
}

export function updateAccountStatus(clientId: string, accountId: string, status: AccountStatus) {
  const account = findAccountById(accountId);
  if (!account || account.client_id !== clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }

  if (account.status === 'closed') {
    throw new AppError('Conta encerrada não pode alterar status.', 400);
  }

  if (status !== 'active' && status !== 'blocked' && status !== 'closed') {
    throw new AppError('Status inválido.', 400);
  }

  db.prepare(`
    UPDATE contas SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, accountId);

  const updated = findAccountById(accountId);
  if (!updated) throw new AppError('Falha ao atualizar conta.', 500);
  return toPublicAccount(updated);
}

/** Depósito para testes/estudo (credita saldo na conta) */
export function depositToAccount(clientId: string, accountId: string, amountReais: number) {
  if (!Number.isFinite(amountReais) || amountReais <= 0) {
    throw new AppError('Valor de depósito inválido.', 400);
  }

  const account = findAccountById(accountId);
  if (!account || account.client_id !== clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  if (account.status !== 'active') {
    throw new AppError('Só é possível depositar em conta ativa.', 400);
  }

  const cents = Math.round(amountReais * 100);
  db.prepare(`
    UPDATE contas
    SET balance_cents = balance_cents + ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(cents, accountId);

  addExtrato({
    clientId,
    accountId,
    tipo: 'deposit',
    direcao: 'in',
    amountCents: cents,
    descricao: 'Depósito em conta',
    referencia: accountId,
  });

  const updated = findAccountById(accountId);
  if (!updated) throw new AppError('Falha ao depositar.', 500);
  return toPublicAccount(updated);
}
