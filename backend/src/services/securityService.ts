import { randomInt, randomUUID, createHash } from 'node:crypto';
import { db, type ClientRow } from '../db/database.js';
import { AppError } from '../utils/errors.js';

function getClient(clientId: string): ClientRow | undefined {
  return db.prepare('SELECT * FROM clientes WHERE id = ?').get(clientId) as ClientRow | undefined;
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export function writeAccessLog(input: {
  clientId?: string | null;
  action: string;
  ip?: string | null;
  userAgent?: string | null;
  success?: boolean;
  details?: Record<string, unknown>;
}) {
  db.prepare(`
    INSERT INTO access_logs (id, client_id, action, ip, user_agent, success, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.clientId ?? null,
    input.action,
    input.ip ?? null,
    input.userAgent ?? null,
    input.success === false ? 0 : 1,
    input.details ? JSON.stringify(input.details) : null,
  );
}

export function listAccessLogs(clientId: string) {
  return (
    db
      .prepare('SELECT * FROM access_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(clientId) as Array<{
      id: string;
      action: string;
      ip: string | null;
      user_agent: string | null;
      success: number;
      details: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    action: row.action,
    ip: row.ip,
    userAgent: row.user_agent,
    success: Boolean(row.success),
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}

function deviceNameFromUa(ua: string) {
  if (/mobile|android|iphone/i.test(ua)) return 'Dispositivo móvel';
  if (/edg/i.test(ua)) return 'Microsoft Edge';
  if (/chrome/i.test(ua)) return 'Google Chrome';
  if (/firefox/i.test(ua)) return 'Mozilla Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Navegador';
}

export function upsertDevice(clientId: string, userAgent: string, ip?: string | null) {
  const ua = userAgent || 'desconhecido';
  const existing = db
    .prepare('SELECT id FROM devices WHERE client_id = ? AND user_agent = ?')
    .get(clientId, ua) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE devices SET last_seen_at = datetime('now'), ip = ? WHERE id = ?
    `).run(ip ?? null, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO devices (id, client_id, device_name, user_agent, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, clientId, deviceNameFromUa(ua), ua, ip ?? null);
  return id;
}

export function listDevices(clientId: string) {
  return (
    db
      .prepare('SELECT * FROM devices WHERE client_id = ? ORDER BY last_seen_at DESC')
      .all(clientId) as Array<{
      id: string;
      device_name: string;
      user_agent: string;
      ip: string | null;
      last_seen_at: string;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    deviceName: row.device_name,
    userAgent: row.user_agent,
    ip: row.ip,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }));
}

export function assertNotLocked(client: ClientRow) {
  if (client.locked_until && new Date(client.locked_until).getTime() > Date.now()) {
    throw new AppError(
      `Conta temporariamente bloqueada por tentativas inválidas. Tente novamente após ${new Date(client.locked_until).toLocaleString('pt-BR')}.`,
      423,
    );
  }
}

export function registerFailedLogin(clientId: string) {
  const client = getClient(clientId);
  if (!client) return;
  const attempts = (client.failed_login_attempts ?? 0) + 1;
  let lockedUntil: string | null = null;
  if (attempts >= MAX_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
  }
  db.prepare(`
    UPDATE clientes
    SET failed_login_attempts = ?, locked_until = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(attempts >= MAX_ATTEMPTS ? 0 : attempts, lockedUntil, clientId);
}

export function clearFailedLogins(clientId: string) {
  db.prepare(`
    UPDATE clientes
    SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(clientId);
}

export function setMfaEnabled(clientId: string, enabled: boolean) {
  db.prepare(`
    UPDATE clientes SET mfa_enabled = ?, updated_at = datetime('now') WHERE id = ?
  `).run(enabled ? 1 : 0, clientId);
}

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function createMfaChallenge(clientId: string) {
  const code = String(randomInt(100000, 1000000));
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE mfa_challenges SET used = 1 WHERE client_id = ? AND used = 0
  `).run(clientId);
  db.prepare(`
    INSERT INTO mfa_challenges (id, client_id, code_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, clientId, hashCode(code), expiresAt);

  return {
    challengeId: id,
    expiresAt,
    // modo estudo: retorna o código (em produção iria por SMS/app)
    code,
  };
}

export function verifyMfaChallenge(challengeId: string, code: string) {
  const row = db
    .prepare('SELECT * FROM mfa_challenges WHERE id = ? AND used = 0')
    .get(challengeId) as
    | { id: string; client_id: string; code_hash: string; expires_at: string }
    | undefined;

  if (!row) throw new AppError('Desafio MFA inválido.', 400);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError('Código MFA expirado.', 400);
  }
  if (row.code_hash !== hashCode(code.trim())) {
    throw new AppError('Código MFA incorreto.', 401);
  }

  db.prepare('UPDATE mfa_challenges SET used = 1 WHERE id = ?').run(challengeId);
  return row.client_id;
}
