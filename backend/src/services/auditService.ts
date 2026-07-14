import { randomUUID } from 'node:crypto';
import { db } from '../db/database.js';

export function writeAuditLog(input: {
  clientId?: string | null;
  transferId?: string | null;
  action: string;
  entity?: string;
  details: Record<string, unknown>;
}) {
  db.prepare(`
    INSERT INTO auditoria (id, client_id, transfer_id, action, entity, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.clientId ?? null,
    input.transferId ?? null,
    input.action,
    input.entity ?? 'transfer',
    JSON.stringify(input.details),
  );
}
