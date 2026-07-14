import { randomUUID } from 'node:crypto';
import { addExtrato, db, toPublicLoan, type LoanRow } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { findAccountById } from './accountService.js';

/** Produto padrão G&M Crédito Pessoal */
export const LOAN_DEFAULTS = {
  principal: 10_000,
  monthlyRate: 0.02, // 2% a.m.
  termMonths: 24,
} as const;

/**
 * Tabela Price (parcelas fixas):
 * PMT = PV * (i * (1+i)^n) / ((1+i)^n - 1)
 */
export function calculateLoan(input?: {
  principal?: number;
  monthlyRate?: number;
  termMonths?: number;
}) {
  const principal = input?.principal ?? LOAN_DEFAULTS.principal;
  const monthlyRate = input?.monthlyRate ?? LOAN_DEFAULTS.monthlyRate;
  const termMonths = input?.termMonths ?? LOAN_DEFAULTS.termMonths;

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new AppError('Valor do empréstimo inválido.', 400);
  }
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) {
    throw new AppError('Taxa inválida.', 400);
  }
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new AppError('Prazo inválido.', 400);
  }

  const factor = (1 + monthlyRate) ** termMonths;
  const installment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * (monthlyRate * factor)) / (factor - 1);

  const installmentCents = Math.round(installment * 100);
  const principalCents = Math.round(principal * 100);
  const totalPaidCents = installmentCents * termMonths;
  const interestCents = totalPaidCents - principalCents;

  return {
    principal,
    principalCents,
    monthlyRate,
    monthlyRatePercent: monthlyRate * 100,
    termMonths,
    installment: installmentCents / 100,
    installmentCents,
    interest: interestCents / 100,
    interestCents,
    totalPaid: totalPaidCents / 100,
    totalPaidCents,
    formula: 'Price',
    formulaDescription:
      'Parcela = Valor × (i × (1+i)^n) / ((1+i)^n − 1), com i = taxa mensal e n = prazo.',
  };
}

function findLoanById(id: string): LoanRow | undefined {
  return db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(id) as LoanRow | undefined;
}

export function simulateLoan(input?: {
  principal?: number;
  monthlyRate?: number;
  termMonths?: number;
}) {
  return calculateLoan(input);
}

export function requestLoan(clientId: string, accountId: string) {
  const account = findAccountById(accountId);
  if (!account || account.client_id !== clientId) {
    throw new AppError('Conta não encontrada.', 404);
  }
  if (account.status !== 'active') {
    throw new AppError('Só é possível solicitar empréstimo para conta ativa.', 400);
  }

  const pending = db
    .prepare(`SELECT id FROM emprestimos WHERE client_id = ? AND status = 'pending'`)
    .get(clientId) as { id: string } | undefined;
  if (pending) {
    throw new AppError('Você já possui uma solicitação de empréstimo em análise.', 409);
  }

  const calc = calculateLoan();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO emprestimos (
      id, client_id, account_id, principal_cents, monthly_rate, term_months,
      installment_cents, interest_cents, total_paid_cents, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    clientId,
    accountId,
    calc.principalCents,
    calc.monthlyRate,
    calc.termMonths,
    calc.installmentCents,
    calc.interestCents,
    calc.totalPaidCents,
  );

  const loan = findLoanById(id);
  if (!loan) throw new AppError('Falha ao solicitar empréstimo.', 500);
  return toPublicLoan(loan);
}

export function approveLoan(clientId: string, loanId: string) {
  const loan = findLoanById(loanId);
  if (!loan || loan.client_id !== clientId) {
    throw new AppError('Empréstimo não encontrado.', 404);
  }
  if (loan.status !== 'pending') {
    throw new AppError('Somente solicitações em análise podem ser aprovadas.', 400);
  }

  const account = findAccountById(loan.account_id);
  if (!account || account.status !== 'active') {
    throw new AppError('Conta vinculada indisponível para crédito.', 400);
  }

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE emprestimos
      SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(loanId);

    db.prepare(`
      UPDATE contas
      SET balance_cents = balance_cents + ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(loan.principal_cents, loan.account_id);

    // Gera parcelas da Tabela Price
    let saldo = loan.principal_cents;
    const i = loan.monthly_rate;
    for (let n = 1; n <= loan.term_months; n += 1) {
      const juros = Math.round(saldo * i);
      const amortizacao = loan.installment_cents - juros;
      saldo = Math.max(0, saldo - amortizacao);
      const venc = new Date();
      venc.setMonth(venc.getMonth() + n);
      db.prepare(`
        INSERT INTO parcelas (
          id, emprestimo_id, numero, valor_cents, juros_cents, amortizacao_cents, saldo_cents, vencimento, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `).run(
        randomUUID(),
        loanId,
        n,
        loan.installment_cents,
        juros,
        amortizacao,
        saldo,
        venc.toISOString().slice(0, 10),
      );
    }

    addExtrato({
      clientId: loan.client_id,
      accountId: loan.account_id,
      tipo: 'emprestimo',
      direcao: 'in',
      amountCents: loan.principal_cents,
      descricao: 'Crédito de empréstimo aprovado',
      referencia: loanId,
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const updated = findLoanById(loanId);
  if (!updated) throw new AppError('Falha ao aprovar empréstimo.', 500);
  return toPublicLoan(updated);
}

export function listLoans(clientId: string) {
  const rows = db
    .prepare('SELECT * FROM emprestimos WHERE client_id = ? ORDER BY created_at DESC')
    .all(clientId) as LoanRow[];
  return rows.map(toPublicLoan);
}

export function getLoan(clientId: string, loanId: string) {
  const loan = findLoanById(loanId);
  if (!loan || loan.client_id !== clientId) {
    throw new AppError('Empréstimo não encontrado.', 404);
  }
  return toPublicLoan(loan);
}
