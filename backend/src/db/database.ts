import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'gm-bank.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

function tableExists(name: string) {
  return Boolean(
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name),
  );
}

function renameTable(from: string, to: string) {
  if (tableExists(from) && !tableExists(to)) {
    db.exec(`ALTER TABLE ${from} RENAME TO ${to}`);
  }
}

/** Migra nomes antigos (EN) → schema mínimo em PT */
function migrateLegacyNames() {
  renameTable('clients', 'clientes');
  renameTable('accounts', 'contas');
  renameTable('cards', 'cartoes');
  renameTable('pix_keys', 'pix');
  renameTable('transfers', 'transferencias');
  renameTable('loans', 'emprestimos');
  renameTable('investments', 'investimentos');
  renameTable('audit_logs', 'auditoria');
  renameTable('account_sequences', 'contas_sequencias');
}

migrateLegacyNames();

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    cpf TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documentos (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contas (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'savings')),
    agency TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contas_sequencias (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );

  INSERT OR IGNORE INTO contas_sequencias (name, value) VALUES ('account_number', 10000000);

  CREATE TABLE IF NOT EXISTS cartoes (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('virtual', 'physical')),
    holder_name TEXT NOT NULL,
    number TEXT NOT NULL UNIQUE,
    cvv TEXT NOT NULL,
    expiration_month INTEGER NOT NULL,
    expiration_year INTEGER NOT NULL,
    pin_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES contas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pix (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cpf', 'phone', 'email', 'random')),
    value TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES contas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transferencias (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('ted', 'internal', 'pix')),
    from_account_id TEXT NOT NULL,
    from_client_id TEXT NOT NULL,
    to_account_id TEXT,
    to_client_id TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    bank_code TEXT,
    agency TEXT,
    account_number TEXT,
    recipient_name TEXT,
    recipient_document TEXT,
    failure_reason TEXT,
    pix_key TEXT,
    end_to_end_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_account_id) REFERENCES contas(id),
    FOREIGN KEY (to_account_id) REFERENCES contas(id),
    FOREIGN KEY (from_client_id) REFERENCES clientes(id),
    FOREIGN KEY (to_client_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS emprestimos (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    principal_cents INTEGER NOT NULL,
    monthly_rate REAL NOT NULL,
    term_months INTEGER NOT NULL,
    installment_cents INTEGER NOT NULL,
    interest_cents INTEGER NOT NULL,
    total_paid_cents INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('simulated', 'pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT,
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES contas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS parcelas (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL,
    numero INTEGER NOT NULL,
    valor_cents INTEGER NOT NULL,
    juros_cents INTEGER NOT NULL,
    amortizacao_cents INTEGER NOT NULL,
    saldo_cents INTEGER NOT NULL,
    vencimento TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS investimentos (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    product TEXT NOT NULL CHECK (product IN ('cdb', 'savings', 'treasury')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    monthly_rate REAL NOT NULL,
    term_months INTEGER NOT NULL,
    projected_yield_cents INTEGER NOT NULL,
    projected_total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES contas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS extratos (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    account_id TEXT,
    tipo TEXT NOT NULL,
    direcao TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
    amount_cents INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    referencia TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES contas(id)
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    transfer_id TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT 'transfer',
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id),
    FOREIGN KEY (transfer_id) REFERENCES transferencias(id)
  );

  CREATE TABLE IF NOT EXISTS usuarios_admin (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    action TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    ip TEXT,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mfa_challenges (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE
  );
`);

/** Colunas extras em clientes (DBs já migrados) */
function ensureClienteColumns() {
  if (!tableExists('clientes')) return;
  const cols = db.prepare('PRAGMA table_info(clientes)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('failed_login_attempts')) {
    db.exec(`ALTER TABLE clientes ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0`);
  }
  if (!names.has('locked_until')) {
    db.exec(`ALTER TABLE clientes ADD COLUMN locked_until TEXT`);
  }
  if (!names.has('mfa_enabled')) {
    db.exec(`ALTER TABLE clientes ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`);
  }
}

ensureClienteColumns();

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS contas_client_type_unique ON contas (client_id, type);
  CREATE UNIQUE INDEX IF NOT EXISTS cartoes_account_type_unique ON cartoes (account_id, type);
  CREATE UNIQUE INDEX IF NOT EXISTS pix_client_type_unique ON pix (client_id, type);
`);

/** Migra documentos antigos e PIX txs → extratos/transferencias */
function migrateAuxiliary() {
  if (tableExists('documents') && !tableExists('documentos')) {
    renameTable('documents', 'documentos');
  } else if (tableExists('documents') && tableExists('documentos')) {
    // Copia residual e remove legado
    db.exec(`
      INSERT OR IGNORE INTO documentos (
        id, client_id, type, original_name, file_name, mime_type, size, uploaded_at
      )
      SELECT id, client_id, type, original_name, file_name, mime_type, size, uploaded_at
      FROM documents;
      DROP TABLE documents;
    `);
  }

  // Garante que transferencias aceite type='pix'
  if (tableExists('transferencias')) {
    const sql = (
      db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='transferencias'`)
        .get() as { sql: string } | undefined
    )?.sql;
    if (sql && !sql.includes("'pix'")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS transferencias_v2 (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('ted', 'internal', 'pix')),
          from_account_id TEXT NOT NULL,
          from_client_id TEXT NOT NULL,
          to_account_id TEXT,
          to_client_id TEXT,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          description TEXT,
          status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
          bank_code TEXT,
          agency TEXT,
          account_number TEXT,
          recipient_name TEXT,
          recipient_document TEXT,
          failure_reason TEXT,
          pix_key TEXT,
          end_to_end_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO transferencias_v2 (
          id, type, from_account_id, from_client_id, to_account_id, to_client_id,
          amount_cents, description, status, bank_code, agency, account_number,
          recipient_name, recipient_document, failure_reason, created_at
        )
        SELECT
          id, type, from_account_id, from_client_id, to_account_id, to_client_id,
          amount_cents, description, status, bank_code, agency, account_number,
          recipient_name, recipient_document, failure_reason, created_at
        FROM transferencias;
        DROP TABLE transferencias;
        ALTER TABLE transferencias_v2 RENAME TO transferencias;
      `);
    }
  }

  if (tableExists('pix_transactions')) {
    const rows = db.prepare('SELECT * FROM pix_transactions').all() as Array<{
      id: string;
      end_to_end_id: string;
      from_account_id: string;
      to_account_id: string;
      from_client_id: string;
      to_client_id: string;
      amount_cents: number;
      pix_key: string;
      description: string | null;
      status: string;
      created_at: string;
    }>;

    for (const row of rows) {
      const exists = db
        .prepare(`SELECT id FROM transferencias WHERE id = ?`)
        .get(row.id);
      if (!exists) {
        db.prepare(`
          INSERT INTO transferencias (
            id, type, from_account_id, from_client_id, to_account_id, to_client_id,
            amount_cents, description, status, pix_key, end_to_end_id, created_at
          ) VALUES (?, 'pix', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          row.id,
          row.from_account_id,
          row.from_client_id,
          row.to_account_id,
          row.to_client_id,
          row.amount_cents,
          row.description,
          row.status,
          row.pix_key,
          row.end_to_end_id,
          row.created_at,
        );
      }

      const outExists = db.prepare(`SELECT id FROM extratos WHERE referencia = ? AND direcao = 'out'`).get(row.id);
      if (!outExists) {
        db.prepare(`
          INSERT INTO extratos (id, client_id, account_id, tipo, direcao, amount_cents, descricao, referencia, created_at)
          VALUES (?, ?, ?, 'pix', 'out', ?, ?, ?, ?)
        `).run(
          randomUUID(),
          row.from_client_id,
          row.from_account_id,
          row.amount_cents,
          row.description || `PIX enviado · ${row.pix_key}`,
          row.id,
          row.created_at,
        );
        db.prepare(`
          INSERT INTO extratos (id, client_id, account_id, tipo, direcao, amount_cents, descricao, referencia, created_at)
          VALUES (?, ?, ?, 'pix', 'in', ?, ?, ?, ?)
        `).run(
          randomUUID(),
          row.to_client_id,
          row.to_account_id,
          row.amount_cents,
          row.description || `PIX recebido · ${row.pix_key}`,
          row.id,
          row.created_at,
        );
      }
    }
    db.exec(`DROP TABLE IF EXISTS pix_transactions`);
  }
}

/** Preenche parcelas ausentes em empréstimos já aprovados (antes da tabela parcelas) */
function backfillParcelas() {
  if (!tableExists('emprestimos') || !tableExists('parcelas')) return;

  const loans = db
    .prepare(`SELECT * FROM emprestimos WHERE status = 'approved'`)
    .all() as Array<{
    id: string;
    principal_cents: number;
    monthly_rate: number;
    term_months: number;
    installment_cents: number;
    approved_at: string | null;
    created_at: string;
  }>;

  for (const loan of loans) {
    const count = (
      db.prepare(`SELECT COUNT(*) as c FROM parcelas WHERE emprestimo_id = ?`).get(loan.id) as {
        c: number;
      }
    ).c;
    if (count > 0) continue;

    let saldo = loan.principal_cents;
    const i = loan.monthly_rate;
    const base = new Date(loan.approved_at || loan.created_at);
    for (let n = 1; n <= loan.term_months; n += 1) {
      const juros = Math.round(saldo * i);
      const amortizacao = loan.installment_cents - juros;
      saldo = Math.max(0, saldo - amortizacao);
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + n);
      db.prepare(`
        INSERT INTO parcelas (
          id, emprestimo_id, numero, valor_cents, juros_cents, amortizacao_cents, saldo_cents, vencimento, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `).run(
        randomUUID(),
        loan.id,
        n,
        loan.installment_cents,
        juros,
        amortizacao,
        saldo,
        venc.toISOString().slice(0, 10),
      );
    }
  }
}

migrateAuxiliary();
backfillParcelas();

export function addExtrato(input: {
  clientId: string;
  accountId?: string | null;
  tipo: string;
  direcao: 'in' | 'out';
  amountCents: number;
  descricao: string;
  referencia?: string | null;
}) {
  db.prepare(`
    INSERT INTO extratos (id, client_id, account_id, tipo, direcao, amount_cents, descricao, referencia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.clientId,
    input.accountId ?? null,
    input.tipo,
    input.direcao,
    input.amountCents,
    input.descricao,
    input.referencia ?? null,
  );
}

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

export type PixKeyRow = {
  id: string;
  client_id: string;
  account_id: string;
  type: PixKeyType;
  value: string;
  created_at: string;
};

export type PixTransactionRow = {
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

const PIX_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  phone: 'Telefone',
  email: 'E-mail',
  random: 'Aleatória',
};

export function toPublicPixKey(row: PixKeyRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    accountId: row.account_id,
    type: row.type,
    typeLabel: PIX_TYPE_LABELS[row.type],
    value: row.value,
    createdAt: row.created_at,
  };
}

export function toPublicPixTransaction(
  row: PixTransactionRow,
  options?: { direction?: 'in' | 'out'; viewerClientId?: string },
) {
  const direction =
    options?.direction ??
    (options?.viewerClientId
      ? options.viewerClientId === row.from_client_id
        ? 'out'
        : 'in'
      : undefined);

  return {
    id: row.id,
    endToEndId: row.end_to_end_id,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    fromClientId: row.from_client_id,
    toClientId: row.to_client_id,
    amount: row.amount_cents / 100,
    amountCents: row.amount_cents,
    pixKey: row.pix_key,
    description: row.description,
    status: row.status,
    direction,
    createdAt: row.created_at,
  };
}

export type TransferType = 'ted' | 'internal' | 'pix';
export type TransferStatus = 'completed' | 'failed';

export type TransferRow = {
  id: string;
  type: TransferType;
  from_account_id: string;
  from_client_id: string;
  to_account_id: string | null;
  to_client_id: string | null;
  amount_cents: number;
  description: string | null;
  status: TransferStatus;
  bank_code: string | null;
  agency: string | null;
  account_number: string | null;
  recipient_name: string | null;
  recipient_document: string | null;
  failure_reason: string | null;
  pix_key?: string | null;
  end_to_end_id?: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  client_id: string | null;
  transfer_id: string | null;
  action: string;
  entity: string;
  details: string;
  created_at: string;
};

export function toPublicTransfer(
  row: TransferRow,
  options?: { viewerClientId?: string },
) {
  const direction =
    options?.viewerClientId &&
    row.to_client_id === options.viewerClientId &&
    row.from_client_id !== options.viewerClientId
      ? 'in'
      : 'out';

  const typeLabel =
    row.type === 'ted' ? 'TED' : row.type === 'pix' ? 'PIX' : 'Transferência interna';

  return {
    id: row.id,
    type: row.type,
    typeLabel,
    fromAccountId: row.from_account_id,
    fromClientId: row.from_client_id,
    toAccountId: row.to_account_id,
    toClientId: row.to_client_id,
    amount: row.amount_cents / 100,
    amountCents: row.amount_cents,
    description: row.description,
    status: row.status,
    statusLabel: row.status === 'completed' ? 'Concluída' : 'Falhou',
    bankCode: row.bank_code,
    agency: row.agency,
    accountNumber: row.account_number,
    recipientName: row.recipient_name,
    recipientDocument: row.recipient_document,
    failureReason: row.failure_reason,
    direction,
    createdAt: row.created_at,
  };
}

export function toPublicAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    transferId: row.transfer_id,
    action: row.action,
    entity: row.entity,
    details: JSON.parse(row.details) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export type ClientRow = {
  id: string;
  cpf: string;
  full_name: string;
  birth_date: string;
  email: string;
  phone: string;
  password_hash: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  created_at: string;
  updated_at: string;
  failed_login_attempts?: number;
  locked_until?: string | null;
  mfa_enabled?: number;
};

export type DocumentRow = {
  id: string;
  client_id: string;
  type: string;
  original_name: string;
  file_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
};

export type AccountType = 'checking' | 'savings';
export type AccountStatus = 'active' | 'blocked' | 'closed';

export type AccountRow = {
  id: string;
  client_id: string;
  type: AccountType;
  agency: string;
  number: string;
  balance_cents: number;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

export function toPublicAccount(row: AccountRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.type,
    typeLabel: row.type === 'checking' ? 'Conta corrente' : 'Conta poupança',
    agency: row.agency,
    number: row.number,
    balance: row.balance_cents / 100,
    balanceCents: row.balance_cents,
    status: row.status,
    statusLabel:
      row.status === 'active' ? 'Ativa' : row.status === 'blocked' ? 'Bloqueada' : 'Encerrada',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicClient(row: ClientRow) {
  return {
    id: row.id,
    cpf: row.cpf,
    fullName: row.full_name,
    birthDate: row.birth_date,
    email: row.email,
    phone: row.phone,
    role: 'client' as const,
    mfaEnabled: Boolean(row.mfa_enabled),
    address: {
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CardType = 'virtual' | 'physical';
export type CardStatus = 'active' | 'blocked';

export type CardRow = {
  id: string;
  client_id: string;
  account_id: string;
  type: CardType;
  holder_name: string;
  number: string;
  cvv: string;
  expiration_month: number;
  expiration_year: number;
  pin_hash: string;
  status: CardStatus;
  created_at: string;
  updated_at: string;
};

export function toPublicCard(row: CardRow) {
  const last4 = row.number.slice(-4);
  return {
    id: row.id,
    clientId: row.client_id,
    accountId: row.account_id,
    type: row.type,
    typeLabel: row.type === 'virtual' ? 'Cartão virtual' : 'Cartão físico',
    holderName: row.holder_name,
    number: row.number,
    numberMasked: `**** **** **** ${last4}`,
    cvv: row.cvv,
    expirationMonth: row.expiration_month,
    expirationYear: row.expiration_year,
    expiration: `${String(row.expiration_month).padStart(2, '0')}/${String(row.expiration_year).slice(-2)}`,
    status: row.status,
    statusLabel: row.status === 'active' ? 'Ativo' : 'Bloqueado',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type LoanStatus = 'simulated' | 'pending' | 'approved' | 'rejected';

export type LoanRow = {
  id: string;
  client_id: string;
  account_id: string;
  principal_cents: number;
  monthly_rate: number;
  term_months: number;
  installment_cents: number;
  interest_cents: number;
  total_paid_cents: number;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  simulated: 'Simulado',
  pending: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export function toPublicLoan(row: LoanRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    accountId: row.account_id,
    principal: row.principal_cents / 100,
    principalCents: row.principal_cents,
    monthlyRate: row.monthly_rate,
    monthlyRatePercent: row.monthly_rate * 100,
    termMonths: row.term_months,
    installment: row.installment_cents / 100,
    installmentCents: row.installment_cents,
    interest: row.interest_cents / 100,
    interestCents: row.interest_cents,
    totalPaid: row.total_paid_cents / 100,
    totalPaidCents: row.total_paid_cents,
    status: row.status,
    statusLabel: LOAN_STATUS_LABELS[row.status],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}

export type InvestmentProduct = 'cdb' | 'savings' | 'treasury';

export type InvestmentRow = {
  id: string;
  client_id: string;
  account_id: string;
  product: InvestmentProduct;
  amount_cents: number;
  monthly_rate: number;
  term_months: number;
  projected_yield_cents: number;
  projected_total_cents: number;
  status: 'active' | 'redeemed';
  created_at: string;
};

const INVESTMENT_LABELS: Record<InvestmentProduct, string> = {
  cdb: 'CDB',
  savings: 'Poupança',
  treasury: 'Tesouro',
};

export function toPublicInvestment(row: InvestmentRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    accountId: row.account_id,
    product: row.product,
    productLabel: INVESTMENT_LABELS[row.product],
    amount: row.amount_cents / 100,
    amountCents: row.amount_cents,
    monthlyRate: row.monthly_rate,
    monthlyRatePercent: row.monthly_rate * 100,
    termMonths: row.term_months,
    projectedYield: row.projected_yield_cents / 100,
    projectedYieldCents: row.projected_yield_cents,
    projectedTotal: row.projected_total_cents / 100,
    projectedTotalCents: row.projected_total_cents,
    status: row.status,
    statusLabel: row.status === 'active' ? 'Ativo' : 'Resgatado',
    createdAt: row.created_at,
  };
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  active: number;
  created_at: string;
  updated_at: string;
};
