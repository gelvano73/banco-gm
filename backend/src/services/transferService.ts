import { randomUUID } from 'node:crypto';
import {
  addExtrato,
  db,
  toPublicAuditLog,
  toPublicTransfer,
  type AuditLogRow,
  type TransferRow,
} from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { sanitizeCpf } from '../utils/cpf.js';
import { findAccountById } from './accountService.js';
import { writeAuditLog } from './auditService.js';

function toCents(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Valor inválido.', 400);
  }
  const cents = Math.round(amount * 100);
  if (cents <= 0) throw new AppError('Valor inválido.', 400);
  return cents;
}

function findTransferById(id: string): TransferRow | undefined {
  return db.prepare('SELECT * FROM transferencias WHERE id = ?').get(id) as TransferRow | undefined;
}

function findAccountByAgencyAndNumber(agency: string, accountNumber: string) {
  return db
    .prepare('SELECT * FROM contas WHERE agency = ? AND number = ?')
    .get(agency.trim(), accountNumber.trim()) as
    | {
        id: string;
        client_id: string;
        status: string;
        balance_cents: number;
      }
    | undefined;
}

function insertTransfer(row: {
  id: string;
  type: 'ted' | 'internal';
  fromAccountId: string;
  fromClientId: string;
  toAccountId?: string | null;
  toClientId?: string | null;
  amountCents: number;
  description?: string | null;
  status: 'completed' | 'failed';
  bankCode?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  recipientName?: string | null;
  recipientDocument?: string | null;
  failureReason?: string | null;
}) {
  db.prepare(`
    INSERT INTO transferencias (
      id, type, from_account_id, from_client_id, to_account_id, to_client_id,
      amount_cents, description, status, bank_code, agency, account_number,
      recipient_name, recipient_document, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.type,
    row.fromAccountId,
    row.fromClientId,
    row.toAccountId ?? null,
    row.toClientId ?? null,
    row.amountCents,
    row.description ?? null,
    row.status,
    row.bankCode ?? null,
    row.agency ?? null,
    row.accountNumber ?? null,
    row.recipientName ?? null,
    row.recipientDocument ?? null,
    row.failureReason ?? null,
  );
}

export function transferInternal(input: {
  clientId: string;
  fromAccountId: string;
  toAgency: string;
  toAccountNumber: string;
  amount: number;
  description?: string;
}) {
  const amountCents = toCents(input.amount);
  const transferId = randomUUID();

  const fromAccount = findAccountById(input.fromAccountId);
  if (!fromAccount || fromAccount.client_id !== input.clientId) {
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.internal.failed',
      details: { reason: 'Conta de origem não encontrada', fromAccountId: input.fromAccountId },
    });
    throw new AppError('Conta de origem não encontrada.', 404);
  }

  if (fromAccount.status !== 'active') {
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.internal.failed',
      details: { reason: 'Conta de origem inativa', fromAccountId: fromAccount.id },
    });
    throw new AppError('Conta de origem precisa estar ativa.', 400);
  }

  const toAccount = findAccountByAgencyAndNumber(input.toAgency, input.toAccountNumber);
  if (!toAccount) {
    insertTransfer({
      id: transferId,
      type: 'internal',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      amountCents,
      description: input.description,
      status: 'failed',
      agency: input.toAgency,
      accountNumber: input.toAccountNumber,
      failureReason: 'Conta de destino não encontrada no G&M Bank',
    });
    writeAuditLog({
      clientId: input.clientId,
      transferId,
      action: 'transfer.internal.failed',
      details: {
        reason: 'Conta de destino não encontrada',
        toAgency: input.toAgency,
        toAccountNumber: input.toAccountNumber,
        amountCents,
      },
    });
    throw new AppError('Conta de destino não encontrada no G&M Bank.', 404);
  }

  if (toAccount.id === fromAccount.id) {
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.internal.failed',
      details: { reason: 'Mesma conta', fromAccountId: fromAccount.id },
    });
    throw new AppError('Não é possível transferir para a mesma conta.', 400);
  }

  if (toAccount.status !== 'active') {
    insertTransfer({
      id: transferId,
      type: 'internal',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      toAccountId: toAccount.id,
      toClientId: toAccount.client_id,
      amountCents,
      description: input.description,
      status: 'failed',
      agency: input.toAgency,
      accountNumber: input.toAccountNumber,
      failureReason: 'Conta de destino inativa',
    });
    writeAuditLog({
      clientId: input.clientId,
      transferId,
      action: 'transfer.internal.failed',
      details: { reason: 'Conta de destino inativa', toAccountId: toAccount.id },
    });
    throw new AppError('Conta de destino precisa estar ativa.', 400);
  }

  if (fromAccount.balance_cents < amountCents) {
    insertTransfer({
      id: transferId,
      type: 'internal',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      toAccountId: toAccount.id,
      toClientId: toAccount.client_id,
      amountCents,
      description: input.description,
      status: 'failed',
      agency: input.toAgency,
      accountNumber: input.toAccountNumber,
      failureReason: 'Saldo insuficiente',
    });
    writeAuditLog({
      clientId: input.clientId,
      transferId,
      action: 'transfer.internal.failed',
      details: {
        reason: 'Saldo insuficiente',
        balanceCents: fromAccount.balance_cents,
        amountCents,
      },
    });
    throw new AppError('Saldo insuficiente para transferência.', 400);
  }

  db.exec('BEGIN');
  try {
    const debit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents - ?, updated_at = datetime('now')
      WHERE id = ? AND balance_cents >= ? AND status = 'active'
    `).run(amountCents, fromAccount.id, amountCents);

    if (debit.changes !== 1) {
      throw new AppError('Saldo insuficiente para transferência.', 400);
    }

    const credit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents + ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(amountCents, toAccount.id);

    if (credit.changes !== 1) {
      throw new AppError('Falha ao creditar conta de destino.', 400);
    }

    insertTransfer({
      id: transferId,
      type: 'internal',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      toAccountId: toAccount.id,
      toClientId: toAccount.client_id,
      amountCents,
      description: input.description,
      status: 'completed',
      agency: input.toAgency,
      accountNumber: input.toAccountNumber,
    });

    addExtrato({
      clientId: fromAccount.client_id,
      accountId: fromAccount.id,
      tipo: 'internal',
      direcao: 'out',
      amountCents,
      descricao: input.description || `Transferência interna · ${input.toAgency}/${input.toAccountNumber}`,
      referencia: transferId,
    });
    addExtrato({
      clientId: toAccount.client_id,
      accountId: toAccount.id,
      tipo: 'internal',
      direcao: 'in',
      amountCents,
      descricao: input.description || 'Transferência interna recebida',
      referencia: transferId,
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.internal.failed',
      details: {
        reason: err instanceof Error ? err.message : 'Erro interno',
        fromAccountId: fromAccount.id,
        amountCents,
      },
    });
    throw err;
  }

  writeAuditLog({
    clientId: input.clientId,
    transferId,
    action: 'transfer.internal.completed',
    details: {
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amountCents,
      description: input.description ?? null,
    },
  });

  const row = findTransferById(transferId);
  if (!row) throw new AppError('Falha ao registrar transferência.', 500);
  return toPublicTransfer(row, { viewerClientId: input.clientId });
}

export function transferTed(input: {
  clientId: string;
  fromAccountId: string;
  bankCode: string;
  agency: string;
  accountNumber: string;
  recipientName: string;
  recipientDocument: string;
  amount: number;
  description?: string;
}) {
  const amountCents = toCents(input.amount);
  const transferId = randomUUID();
  const document = sanitizeCpf(input.recipientDocument) || input.recipientDocument.replace(/\D/g, '');

  const fromAccount = findAccountById(input.fromAccountId);
  if (!fromAccount || fromAccount.client_id !== input.clientId) {
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.ted.failed',
      details: { reason: 'Conta de origem não encontrada', fromAccountId: input.fromAccountId },
    });
    throw new AppError('Conta de origem não encontrada.', 404);
  }

  if (fromAccount.status !== 'active') {
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.ted.failed',
      details: { reason: 'Conta de origem inativa', fromAccountId: fromAccount.id },
    });
    throw new AppError('Conta de origem precisa estar ativa.', 400);
  }

  if (!input.bankCode.trim() || !input.agency.trim() || !input.accountNumber.trim()) {
    throw new AppError('Informe banco, agência e conta do destinatário.', 400);
  }

  if (!input.recipientName.trim() || document.length < 11) {
    throw new AppError('Informe nome e CPF/CNPJ do destinatário.', 400);
  }

  // TED é para outro banco; se for a própria agência G&M (0001), orientar transferência interna
  if (input.bankCode.trim() === '000' || input.bankCode.trim() === 'GM') {
    throw new AppError('Para contas G&M Bank use transferência interna.', 400);
  }

  if (fromAccount.balance_cents < amountCents) {
    insertTransfer({
      id: transferId,
      type: 'ted',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      amountCents,
      description: input.description,
      status: 'failed',
      bankCode: input.bankCode.trim(),
      agency: input.agency.trim(),
      accountNumber: input.accountNumber.trim(),
      recipientName: input.recipientName.trim(),
      recipientDocument: document,
      failureReason: 'Saldo insuficiente',
    });
    writeAuditLog({
      clientId: input.clientId,
      transferId,
      action: 'transfer.ted.failed',
      details: {
        reason: 'Saldo insuficiente',
        balanceCents: fromAccount.balance_cents,
        amountCents,
        bankCode: input.bankCode.trim(),
      },
    });
    throw new AppError('Saldo insuficiente para TED.', 400);
  }

  db.exec('BEGIN');
  try {
    const debit = db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents - ?, updated_at = datetime('now')
      WHERE id = ? AND balance_cents >= ? AND status = 'active'
    `).run(amountCents, fromAccount.id, amountCents);

    if (debit.changes !== 1) {
      throw new AppError('Saldo insuficiente para TED.', 400);
    }

    insertTransfer({
      id: transferId,
      type: 'ted',
      fromAccountId: fromAccount.id,
      fromClientId: input.clientId,
      amountCents,
      description: input.description,
      status: 'completed',
      bankCode: input.bankCode.trim(),
      agency: input.agency.trim(),
      accountNumber: input.accountNumber.trim(),
      recipientName: input.recipientName.trim(),
      recipientDocument: document,
    });

    addExtrato({
      clientId: fromAccount.client_id,
      accountId: fromAccount.id,
      tipo: 'ted',
      direcao: 'out',
      amountCents,
      descricao:
        input.description ||
        `TED · banco ${input.bankCode.trim()} · ${input.agency.trim()}/${input.accountNumber.trim()}`,
      referencia: transferId,
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    writeAuditLog({
      clientId: input.clientId,
      action: 'transfer.ted.failed',
      details: {
        reason: err instanceof Error ? err.message : 'Erro interno',
        fromAccountId: fromAccount.id,
        amountCents,
      },
    });
    throw err;
  }

  writeAuditLog({
    clientId: input.clientId,
    transferId,
    action: 'transfer.ted.completed',
    details: {
      fromAccountId: fromAccount.id,
      amountCents,
      bankCode: input.bankCode.trim(),
      agency: input.agency.trim(),
      accountNumber: input.accountNumber.trim(),
      recipientName: input.recipientName.trim(),
      recipientDocument: document,
    },
  });

  const row = findTransferById(transferId);
  if (!row) throw new AppError('Falha ao registrar TED.', 500);
  return toPublicTransfer(row, { viewerClientId: input.clientId });
}

export function listTransfers(clientId: string) {
  const rows = db
    .prepare(`
      SELECT * FROM transferencias
      WHERE from_client_id = ? OR to_client_id = ?
      ORDER BY created_at DESC
    `)
    .all(clientId, clientId) as TransferRow[];

  return rows.map((row) => toPublicTransfer(row, { viewerClientId: clientId }));
}

export function getTransfer(clientId: string, transferId: string) {
  const row = findTransferById(transferId);
  if (!row || (row.from_client_id !== clientId && row.to_client_id !== clientId)) {
    throw new AppError('Transferência não encontrada.', 404);
  }
  return toPublicTransfer(row, { viewerClientId: clientId });
}

export function listAuditLogs(clientId: string) {
  const rows = db
    .prepare(`
      SELECT * FROM auditoria
      WHERE client_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .all(clientId) as AuditLogRow[];

  return rows.map(toPublicAuditLog);
}
