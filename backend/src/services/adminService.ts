import { randomUUID } from 'node:crypto';
import { db, type AdminUserRow } from '../db/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';

const ADMIN_EMAIL = 'admin@gmbank.local';
const ADMIN_PASSWORD = 'Admin@123';

export async function ensureAdminUser() {
  const existing = db
    .prepare('SELECT id FROM usuarios_admin WHERE email = ?')
    .get(ADMIN_EMAIL) as { id: string } | undefined;
  if (existing) return;

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  db.prepare(`
    INSERT INTO usuarios_admin (id, name, email, password_hash, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(randomUUID(), 'Administrador G&M', ADMIN_EMAIL, passwordHash);
}

export function findAdminById(id: string): AdminUserRow | undefined {
  return db.prepare('SELECT * FROM usuarios_admin WHERE id = ?').get(id) as AdminUserRow | undefined;
}

export function findAdminByEmail(email: string): AdminUserRow | undefined {
  return db
    .prepare('SELECT * FROM usuarios_admin WHERE email = ?')
    .get(email.toLowerCase().trim()) as AdminUserRow | undefined;
}

export async function authenticateAdmin(email: string, password: string) {
  const admin = findAdminByEmail(email);
  if (!admin || !admin.active) {
    throw new AppError('CPF/e-mail ou senha incorretos.', 401);
  }
  const ok = await comparePassword(password, admin.password_hash);
  if (!ok) throw new AppError('CPF/e-mail ou senha incorretos.', 401);

  return {
    id: admin.id,
    cpf: '00000000000',
    fullName: admin.name,
    birthDate: '1990-01-01',
    email: admin.email,
    phone: '',
    role: 'admin' as const,
    mfaEnabled: false,
    address: {
      street: '-',
      number: '-',
      complement: null,
      neighborhood: '-',
      city: '-',
      state: '--',
      zipCode: '00000000',
    },
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
  };
}

export function getAdminDashboard() {
  const totalClients = (db.prepare(`SELECT COUNT(*) as c FROM clientes`).get() as { c: number }).c;
  const totalAccounts = (db.prepare(`SELECT COUNT(*) as c FROM contas`).get() as { c: number }).c;

  const pixVolume = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as s FROM transferencias WHERE type = 'pix' AND status = 'completed'`,
      )
      .get() as { s: number }
  ).s;

  const tedVolume = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as s FROM transferencias WHERE type = 'ted' AND status = 'completed'`,
      )
      .get() as { s: number }
  ).s;

  const activeLoans = (
    db.prepare(`SELECT COUNT(*) as c FROM emprestimos WHERE status = 'approved'`).get() as {
      c: number;
    }
  ).c;

  const loanInterest = (
    db
      .prepare(`SELECT COALESCE(SUM(interest_cents), 0) as s FROM emprestimos WHERE status = 'approved'`)
      .get() as { s: number }
  ).s;

  const investmentAmount = (
    db
      .prepare(`SELECT COALESCE(SUM(amount_cents), 0) as s FROM investimentos WHERE status = 'active'`)
      .get() as { s: number }
  ).s;

  const estimatedRevenueCents = loanInterest + Math.round(investmentAmount * 0.005);

  return {
    totalClients,
    totalAccounts,
    pixVolume: pixVolume / 100,
    pixVolumeCents: pixVolume,
    tedVolume: tedVolume / 100,
    tedVolumeCents: tedVolume,
    activeLoans,
    estimatedRevenue: estimatedRevenueCents / 100,
    estimatedRevenueCents,
  };
}
