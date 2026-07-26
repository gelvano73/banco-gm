import { randomUUID } from 'node:crypto';
import { db, toPublicClient, type ClientRow, type DocumentRow } from '../db/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { sanitizeCpf } from '../utils/cpf.js';
import type { RegisterInput } from '../utils/validators.js';
import { AppError } from '../utils/errors.js';
import {
  assertNotLocked,
  clearFailedLogins,
  registerFailedLogin,
} from './securityService.js';

export { AppError };

export function findClientByCpf(cpf: string): ClientRow | undefined {
  return db
    .prepare('SELECT * FROM clientes WHERE cpf = ?')
    .get(sanitizeCpf(cpf)) as ClientRow | undefined;
}

export function findClientByEmail(email: string): ClientRow | undefined {
  return db
    .prepare('SELECT * FROM clientes WHERE email = ?')
    .get(email.toLowerCase().trim()) as ClientRow | undefined;
}

export function findClientById(id: string): ClientRow | undefined {
  return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as ClientRow | undefined;
}

export function findClientByCpfOrEmail(cpfOrEmail: string): ClientRow | undefined {
  const value = cpfOrEmail.trim();
  if (value.includes('@')) {
    return findClientByEmail(value);
  }
  return findClientByCpf(value);
}

export async function registerClient(input: RegisterInput) {
  if (findClientByCpf(input.cpf)) {
    throw new AppError('Já existe um cliente cadastrado com este CPF.', 409);
  }

  if (findClientByEmail(input.email)) {
    throw new AppError('Já existe um cliente cadastrado com este e-mail.', 409);
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);

  db.prepare(`
    INSERT INTO clientes (
      id, cpf, full_name, birth_date, email, phone, password_hash,
      street, number, complement, neighborhood, city, state, zip_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.cpf,
    input.fullName,
    input.birthDate,
    input.email,
    input.phone,
    passwordHash,
    input.street,
    input.number,
    input.complement ?? null,
    input.neighborhood,
    input.city,
    input.state,
    input.zipCode,
  );

  const client = findClientById(id);
  if (!client) throw new AppError('Falha ao criar cliente.', 500);
  return toPublicClient(client);
}

export async function authenticateClient(cpfOrEmail: string, password: string) {
  const client = findClientByCpfOrEmail(cpfOrEmail);
  if (!client) {
    throw new AppError('CPF/e-mail ou senha incorretos.', 401);
  }

  assertNotLocked(client);

  const ok = await comparePassword(password, client.password_hash);
  if (!ok) {
    registerFailedLogin(client.id);
    throw new AppError('CPF/e-mail ou senha incorretos.', 401);
  }

  clearFailedLogins(client.id);
  return toPublicClient(findClientById(client.id)!);
}

export async function createPasswordReset(email: string) {
  const client = findClientByEmail(email);
  // Resposta genérica evita enumeração de e-mails
  if (!client) {
    return { message: 'Se o e-mail existir, enviaremos instruções de recuperação.', token: null as string | null };
  }

  const id = randomUUID();
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.prepare('UPDATE password_resets SET used = 1 WHERE client_id = ? AND used = 0').run(client.id);
  db.prepare(`
    INSERT INTO password_resets (id, client_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, client.id, token, expiresAt);

  return {
    message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
    // Em produção o token iria por e-mail. No modo estudo retornamos para facilitar testes.
    token,
    expiresAt,
  };
}

export async function resetPassword(token: string, newPassword: string) {
  const reset = db
    .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
    .get(token) as
    | { id: string; client_id: string; expires_at: string; used: number }
    | undefined;

  if (!reset) {
    throw new AppError('Token de recuperação inválido.', 400);
  }

  if (new Date(reset.expires_at).getTime() < Date.now()) {
    throw new AppError('Token de recuperação expirado.', 400);
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare(`
    UPDATE clientes SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).run(passwordHash, reset.client_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);

  return { message: 'Senha redefinida com sucesso.' };
}

export function listDocuments(clientId: string): DocumentRow[] {
  return db
    .prepare('SELECT * FROM documentos WHERE client_id = ? ORDER BY uploaded_at DESC')
    .all(clientId) as DocumentRow[];
}

export function addDocument(input: {
  clientId: string;
  type: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO documentos (id, client_id, type, original_name, file_name, mime_type, size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.clientId,
    input.type,
    input.originalName,
    input.fileName,
    input.mimeType,
    input.size,
  );

  return db.prepare('SELECT * FROM documentos WHERE id = ?').get(id) as DocumentRow;
}
